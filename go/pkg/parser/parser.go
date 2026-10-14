// Package parser implements a recursive-descent parser for a subset of
// TypeScript sufficient to compile tyvm benchmarks. It produces IR nodes
// directly (combined parse + lower) since we control the grammar.
package parser

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/tyvm/tyvm/pkg/ir"
	"github.com/tyvm/tyvm/pkg/lexer"
)

type Parser struct {
	tokens []lexer.Token
	pos    int
}

func New(tokens []lexer.Token) *Parser {
	return &Parser{tokens: tokens}
}

func (p *Parser) peek() lexer.Token {
	if p.pos >= len(p.tokens) {
		return lexer.Token{Kind: lexer.TokenEOF}
	}
	return p.tokens[p.pos]
}

func (p *Parser) advance() lexer.Token {
	tok := p.peek()
	p.pos++
	return tok
}

func (p *Parser) expect(kind lexer.TokenKind) (lexer.Token, error) {
	tok := p.peek()
	if tok.Kind != kind {
		return tok, fmt.Errorf("%d:%d: expected token %d, got %d (%q)",
			tok.Line, tok.Col, kind, tok.Kind, tok.Value)
	}
	return p.advance(), nil
}

func (p *Parser) at(kind lexer.TokenKind) bool {
	return p.peek().Kind == kind
}

func (p *Parser) match(kind lexer.TokenKind) bool {
	if p.at(kind) {
		p.advance()
		return true
	}
	return false
}

// Parse parses the token stream into an IR Module.
func (p *Parser) Parse(moduleName string) (*ir.Module, error) {
	mod := &ir.Module{Name: moduleName}

	// Collect top-level statements into a synthetic "main" function
	var mainStmts []ir.Stmt

	for !p.at(lexer.TokenEOF) {
		if p.at(lexer.TokenFunction) {
			fn, err := p.parseFunction()
			if err != nil {
				return nil, err
			}
			mod.Functions = append(mod.Functions, fn)
		} else {
			stmt, err := p.parseStatement()
			if err != nil {
				return nil, err
			}
			if stmt != nil {
				mainStmts = append(mainStmts, stmt)
			}
		}
	}

	// If there are top-level statements, wrap them in a main function
	if len(mainStmts) > 0 {
		mainFn := &ir.FunctionDef{
			Name:       "main",
			Params:     []ir.Param{{Name: "args", Type: ir.TyArray{ElementType: ir.TyString{}}}},
			ReturnType: ir.TyVoid{},
			Body:       &ir.Block{Stmts: mainStmts},
			IsExported: true,
		}
		// Prepend main so it's the first function
		mod.Functions = append([]*ir.FunctionDef{mainFn}, mod.Functions...)
	}

	return mod, nil
}

func (p *Parser) parseFunction() (*ir.FunctionDef, error) {
	p.expect(lexer.TokenFunction)
	nameTok, err := p.expect(lexer.TokenIdent)
	if err != nil {
		return nil, err
	}

	_, err = p.expect(lexer.TokenLParen)
	if err != nil {
		return nil, err
	}

	var params []ir.Param
	for !p.at(lexer.TokenRParen) && !p.at(lexer.TokenEOF) {
		paramName, err := p.expect(lexer.TokenIdent)
		if err != nil {
			return nil, err
		}
		paramType := ir.JvmType(ir.TyDouble{}) // default
		if p.match(lexer.TokenColon) {
			paramType = p.parseTypeAnnotation()
		}
		params = append(params, ir.Param{Name: paramName.Value, Type: paramType})
		p.match(lexer.TokenComma)
	}
	p.expect(lexer.TokenRParen)

	// Optional return type annotation
	retType := ir.JvmType(ir.TyDouble{})
	if p.match(lexer.TokenColon) {
		retType = p.parseTypeAnnotation()
	}

	body, err := p.parseBlock()
	if err != nil {
		return nil, err
	}

	return &ir.FunctionDef{
		Name:       nameTok.Value,
		Params:     params,
		ReturnType: retType,
		Body:       body,
	}, nil
}

func (p *Parser) parseTypeAnnotation() ir.JvmType {
	tok := p.advance()
	switch tok.Value {
	case "number":
		return ir.TyDouble{}
	case "string":
		return ir.TyString{}
	case "boolean":
		return ir.TyBoolean{}
	case "void":
		return ir.TyVoid{}
	default:
		return ir.TyDouble{}
	}
}

func (p *Parser) parseBlock() (*ir.Block, error) {
	_, err := p.expect(lexer.TokenLBrace)
	if err != nil {
		return nil, err
	}

	var stmts []ir.Stmt
	for !p.at(lexer.TokenRBrace) && !p.at(lexer.TokenEOF) {
		stmt, err := p.parseStatement()
		if err != nil {
			return nil, err
		}
		if stmt != nil {
			stmts = append(stmts, stmt)
		}
	}
	p.expect(lexer.TokenRBrace)
	return &ir.Block{Stmts: stmts}, nil
}

func (p *Parser) parseStatement() (ir.Stmt, error) {
	switch p.peek().Kind {
	case lexer.TokenLet, lexer.TokenConst, lexer.TokenVar:
		return p.parseVarDecl()
	case lexer.TokenReturn:
		return p.parseReturn()
	case lexer.TokenIf:
		return p.parseIf()
	case lexer.TokenWhile:
		return p.parseWhile()
	case lexer.TokenFor:
		return p.parseFor()
	case lexer.TokenLBrace:
		blk, err := p.parseBlock()
		if err != nil {
			return nil, err
		}
		return blk, nil
	default:
		return p.parseExprStatement()
	}
}

func (p *Parser) parseVarDecl() (ir.Stmt, error) {
	p.advance() // let/const/var
	nameTok, err := p.expect(lexer.TokenIdent)
	if err != nil {
		return nil, err
	}

	varType := ir.JvmType(ir.TyDouble{})
	if p.match(lexer.TokenColon) {
		varType = p.parseTypeAnnotation()
	}

	var init ir.Expr
	if p.match(lexer.TokenAssign) {
		init, err = p.parseExpression()
		if err != nil {
			return nil, err
		}
	}

	p.match(lexer.TokenSemicolon)

	// Infer type from initializer
	if init != nil {
		varType = inferType(init)
	}

	return &ir.VarDecl{
		Name:     nameTok.Value,
		DeclType: varType,
		Init:     init,
	}, nil
}

func inferType(e ir.Expr) ir.JvmType {
	if e == nil {
		return ir.TyDouble{}
	}
	return e.Type()
}

func (p *Parser) parseReturn() (ir.Stmt, error) {
	p.advance() // return
	var expr ir.Expr
	if !p.at(lexer.TokenSemicolon) && !p.at(lexer.TokenRBrace) {
		var err error
		expr, err = p.parseExpression()
		if err != nil {
			return nil, err
		}
	}
	p.match(lexer.TokenSemicolon)
	return &ir.Return{Expr: expr}, nil
}

func (p *Parser) parseIf() (ir.Stmt, error) {
	p.advance() // if
	p.expect(lexer.TokenLParen)
	cond, err := p.parseExpression()
	if err != nil {
		return nil, err
	}
	p.expect(lexer.TokenRParen)

	then, err := p.parseBlock()
	if err != nil {
		return nil, err
	}

	var elseBlk *ir.Block
	if p.match(lexer.TokenElse) {
		if p.at(lexer.TokenIf) {
			// else if -> wrap in block
			inner, err := p.parseIf()
			if err != nil {
				return nil, err
			}
			elseBlk = &ir.Block{Stmts: []ir.Stmt{inner}}
		} else {
			elseBlk, err = p.parseBlock()
			if err != nil {
				return nil, err
			}
		}
	}

	return &ir.If{Condition: cond, Then: then, Else: elseBlk}, nil
}

func (p *Parser) parseWhile() (ir.Stmt, error) {
	p.advance() // while
	p.expect(lexer.TokenLParen)
	cond, err := p.parseExpression()
	if err != nil {
		return nil, err
	}
	p.expect(lexer.TokenRParen)

	body, err := p.parseBlock()
	if err != nil {
		return nil, err
	}

	return &ir.While{Condition: cond, Body: body}, nil
}

func (p *Parser) parseFor() (ir.Stmt, error) {
	p.advance() // for
	p.expect(lexer.TokenLParen)

	// Init
	var init ir.Stmt
	if p.at(lexer.TokenLet) || p.at(lexer.TokenConst) || p.at(lexer.TokenVar) {
		var err error
		init, err = p.parseVarDecl()
		if err != nil {
			return nil, err
		}
	} else if !p.at(lexer.TokenSemicolon) {
		expr, err := p.parseExpression()
		if err != nil {
			return nil, err
		}
		init = &ir.ExprStmt{Expr: expr}
		p.match(lexer.TokenSemicolon)
	} else {
		p.match(lexer.TokenSemicolon)
	}

	// Condition
	var cond ir.Expr
	if !p.at(lexer.TokenSemicolon) {
		var err error
		cond, err = p.parseExpression()
		if err != nil {
			return nil, err
		}
	}
	p.match(lexer.TokenSemicolon)

	// Update
	var update ir.Expr
	if !p.at(lexer.TokenRParen) {
		var err error
		update, err = p.parseExpression()
		if err != nil {
			return nil, err
		}
	}
	p.expect(lexer.TokenRParen)

	body, err := p.parseBlock()
	if err != nil {
		return nil, err
	}

	return &ir.For{Init: init, Condition: cond, Update: update, Body: body}, nil
}

func (p *Parser) parseExprStatement() (ir.Stmt, error) {
	expr, err := p.parseExpression()
	if err != nil {
		return nil, err
	}
	p.match(lexer.TokenSemicolon)
	return &ir.ExprStmt{Expr: expr}, nil
}

// --- Expression parsing (precedence climbing) ---

func (p *Parser) parseExpression() (ir.Expr, error) {
	return p.parseAssignment()
}

func (p *Parser) parseAssignment() (ir.Expr, error) {
	expr, err := p.parseOr()
	if err != nil {
		return nil, err
	}

	if p.match(lexer.TokenAssign) {
		val, err := p.parseAssignment()
		if err != nil {
			return nil, err
		}
		if ld, ok := expr.(*ir.LoadLocal); ok {
			return &ir.StoreLocal{Name: ld.Name, Val: val, ExprType: val.Type()}, nil
		}
		return nil, fmt.Errorf("invalid assignment target")
	}
	return expr, nil
}

func (p *Parser) parseOr() (ir.Expr, error) {
	left, err := p.parseAnd()
	if err != nil {
		return nil, err
	}
	for p.match(lexer.TokenOr) {
		right, err := p.parseAnd()
		if err != nil {
			return nil, err
		}
		left = &ir.BinaryOp{Op: "||", Left: left, Right: right, ExprType: ir.TyBoolean{}}
	}
	return left, nil
}

func (p *Parser) parseAnd() (ir.Expr, error) {
	left, err := p.parseEquality()
	if err != nil {
		return nil, err
	}
	for p.match(lexer.TokenAnd) {
		right, err := p.parseEquality()
		if err != nil {
			return nil, err
		}
		left = &ir.BinaryOp{Op: "&&", Left: left, Right: right, ExprType: ir.TyBoolean{}}
	}
	return left, nil
}

func (p *Parser) parseEquality() (ir.Expr, error) {
	left, err := p.parseComparison()
	if err != nil {
		return nil, err
	}
	for {
		var op string
		switch p.peek().Kind {
		case lexer.TokenEq:
			op = "=="
		case lexer.TokenEqEq:
			op = "=="
		case lexer.TokenNeq:
			op = "!="
		case lexer.TokenNeqEq:
			op = "!="
		default:
			return left, nil
		}
		p.advance()
		right, err := p.parseComparison()
		if err != nil {
			return nil, err
		}
		left = &ir.BinaryOp{Op: op, Left: left, Right: right, ExprType: ir.TyBoolean{}}
	}
}

func (p *Parser) parseComparison() (ir.Expr, error) {
	left, err := p.parseAdditive()
	if err != nil {
		return nil, err
	}
	for {
		var op string
		switch p.peek().Kind {
		case lexer.TokenLt:
			op = "<"
		case lexer.TokenGt:
			op = ">"
		case lexer.TokenLte:
			op = "<="
		case lexer.TokenGte:
			op = ">="
		default:
			return left, nil
		}
		p.advance()
		right, err := p.parseAdditive()
		if err != nil {
			return nil, err
		}
		left = &ir.BinaryOp{Op: op, Left: left, Right: right, ExprType: ir.TyBoolean{}}
	}
}

func (p *Parser) parseAdditive() (ir.Expr, error) {
	left, err := p.parseMultiplicative()
	if err != nil {
		return nil, err
	}
	for {
		var op string
		switch p.peek().Kind {
		case lexer.TokenPlus:
			op = "+"
		case lexer.TokenMinus:
			op = "-"
		default:
			return left, nil
		}
		p.advance()
		right, err := p.parseMultiplicative()
		if err != nil {
			return nil, err
		}
		// Determine result type
		resultType := binaryResultType(left.Type(), right.Type(), op)
		left = &ir.BinaryOp{Op: op, Left: left, Right: right, ExprType: resultType}
	}
}

func (p *Parser) parseMultiplicative() (ir.Expr, error) {
	left, err := p.parseUnary()
	if err != nil {
		return nil, err
	}
	for {
		var op string
		switch p.peek().Kind {
		case lexer.TokenStar:
			op = "*"
		case lexer.TokenSlash:
			op = "/"
		case lexer.TokenPercent:
			op = "%"
		default:
			return left, nil
		}
		p.advance()
		right, err := p.parseUnary()
		if err != nil {
			return nil, err
		}
		resultType := binaryResultType(left.Type(), right.Type(), op)
		left = &ir.BinaryOp{Op: op, Left: left, Right: right, ExprType: resultType}
	}
}

func binaryResultType(lt, rt ir.JvmType, op string) ir.JvmType {
	// String concatenation
	if op == "+" {
		if _, ok := lt.(ir.TyString); ok {
			return ir.TyString{}
		}
		if _, ok := rt.(ir.TyString); ok {
			return ir.TyString{}
		}
	}
	// If both int, stay int
	_, lInt := lt.(ir.TyInt)
	_, rInt := rt.(ir.TyInt)
	_, lLong := lt.(ir.TyLong)
	_, rLong := rt.(ir.TyLong)
	if (lInt || lLong) && (rInt || rLong) {
		if lLong || rLong {
			return ir.TyLong{}
		}
		return ir.TyInt{}
	}
	return ir.TyDouble{}
}

func (p *Parser) parseUnary() (ir.Expr, error) {
	if p.match(lexer.TokenMinus) {
		operand, err := p.parseUnary()
		if err != nil {
			return nil, err
		}
		return &ir.UnaryOp{Op: "-", Operand: operand, ExprType: operand.Type()}, nil
	}
	if p.match(lexer.TokenBang) {
		operand, err := p.parseUnary()
		if err != nil {
			return nil, err
		}
		return &ir.UnaryOp{Op: "!", Operand: operand, ExprType: ir.TyBoolean{}}, nil
	}
	return p.parsePostfix()
}

func (p *Parser) parsePostfix() (ir.Expr, error) {
	expr, err := p.parsePrimary()
	if err != nil {
		return nil, err
	}

	for {
		if p.at(lexer.TokenDot) {
			p.advance()
			prop, err := p.expect(lexer.TokenIdent)
			if err != nil {
				// Could be "log" after console
				prop = p.advance()
			}
			// Method call: expr.method(args)
			if p.match(lexer.TokenLParen) {
				args, err := p.parseArgList()
				if err != nil {
					return nil, err
				}
				// Handle console.log specially
				if ld, ok := expr.(*ir.LoadLocal); ok && ld.Name == "console" && prop.Value == "log" {
					expr = &ir.Call{
						Target:     "println",
						ClassName:  "tyvm/runtime/Rt",
						Args:       args,
						ReturnType: ir.TyVoid{},
						IsStatic:   true,
					}
					continue
				}
				// Generic method call
				callArgs := append([]ir.Expr{expr}, args...)
				expr = &ir.Call{
					Target:     prop.Value,
					ClassName:  "java/lang/Object",
					Args:       callArgs,
					ReturnType: ir.TyDouble{},
					IsStatic:   false,
				}
				continue
			}
			// Property access (not used in basic benchmarks)
			_ = prop
		} else if p.match(lexer.TokenLParen) {
			// Direct function call: expr(args) -- only for identifiers
			args, err := p.parseArgList()
			if err != nil {
				return nil, err
			}
			if ld, ok := expr.(*ir.LoadLocal); ok {
				expr = &ir.Call{
					Target:     ld.Name,
					ClassName:  "", // will be resolved to module name
					Args:       args,
					ReturnType: ir.TyDouble{},
					IsStatic:   true,
				}
			}
		} else if p.match(lexer.TokenLBracket) {
			// Array access
			index, err := p.parseExpression()
			if err != nil {
				return nil, err
			}
			p.expect(lexer.TokenRBracket)
			expr = &ir.ArrayGet{Array: expr, Index: index, ExprType: ir.TyDouble{}}
		} else {
			break
		}
	}

	return expr, nil
}

func (p *Parser) parseArgList() ([]ir.Expr, error) {
	var args []ir.Expr
	for !p.at(lexer.TokenRParen) && !p.at(lexer.TokenEOF) {
		arg, err := p.parseExpression()
		if err != nil {
			return nil, err
		}
		args = append(args, arg)
		p.match(lexer.TokenComma)
	}
	p.expect(lexer.TokenRParen)
	return args, nil
}

func (p *Parser) parsePrimary() (ir.Expr, error) {
	tok := p.peek()

	switch tok.Kind {
	case lexer.TokenNumber:
		p.advance()
		return parseNumberLiteral(tok.Value), nil

	case lexer.TokenString:
		p.advance()
		// Strip quotes
		val := tok.Value[1 : len(tok.Value)-1]
		// Handle escape sequences
		val = strings.ReplaceAll(val, "\\n", "\n")
		val = strings.ReplaceAll(val, "\\t", "\t")
		val = strings.ReplaceAll(val, "\\\\", "\\")
		val = strings.ReplaceAll(val, "\\\"", "\"")
		return &ir.Const{Value: val, ExprType: ir.TyString{}}, nil

	case lexer.TokenTrue:
		p.advance()
		return &ir.Const{Value: true, ExprType: ir.TyBoolean{}}, nil

	case lexer.TokenFalse:
		p.advance()
		return &ir.Const{Value: false, ExprType: ir.TyBoolean{}}, nil

	case lexer.TokenNull:
		p.advance()
		return &ir.Const{Value: nil, ExprType: ir.TyObject{ClassName: "java/lang/Object"}}, nil

	case lexer.TokenIdent, lexer.TokenConsole:
		p.advance()
		return &ir.LoadLocal{Name: tok.Value, ExprType: ir.TyDouble{}}, nil

	case lexer.TokenLParen:
		p.advance()
		expr, err := p.parseExpression()
		if err != nil {
			return nil, err
		}
		p.expect(lexer.TokenRParen)
		return expr, nil

	default:
		return nil, fmt.Errorf("%d:%d: unexpected token %q", tok.Line, tok.Col, tok.Value)
	}
}

func parseNumberLiteral(s string) ir.Expr {
	// Try integer first
	if !strings.Contains(s, ".") {
		if v, err := strconv.ParseInt(s, 10, 64); err == nil {
			return &ir.Const{Value: v, ExprType: ir.TyDouble{}}
		}
	}
	v, _ := strconv.ParseFloat(s, 64)
	return &ir.Const{Value: v, ExprType: ir.TyDouble{}}
}
