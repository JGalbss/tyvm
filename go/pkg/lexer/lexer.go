package lexer

import (
	"fmt"
	"unicode"
)

// Lexer tokenizes TypeScript source text.
type Lexer struct {
	src    []byte
	pos    int
	line   int
	col    int
	tokens []Token
}

// New creates a lexer for the given source.
func New(src []byte) *Lexer {
	return &Lexer{src: src, line: 1, col: 1}
}

// Tokenize scans the entire source and returns all tokens.
func (l *Lexer) Tokenize() ([]Token, error) {
	for {
		tok, err := l.next()
		if err != nil {
			return nil, err
		}
		l.tokens = append(l.tokens, tok)
		if tok.Kind == TokenEOF {
			break
		}
	}
	return l.tokens, nil
}

func (l *Lexer) peek() byte {
	if l.pos >= len(l.src) {
		return 0
	}
	return l.src[l.pos]
}

func (l *Lexer) advance() byte {
	ch := l.src[l.pos]
	l.pos++
	if ch == '\n' {
		l.line++
		l.col = 1
	} else {
		l.col++
	}
	return ch
}

func (l *Lexer) skipWhitespace() {
	for l.pos < len(l.src) {
		ch := l.src[l.pos]
		if ch == ' ' || ch == '\t' || ch == '\r' || ch == '\n' {
			l.advance()
		} else if ch == '/' && l.pos+1 < len(l.src) && l.src[l.pos+1] == '/' {
			// line comment
			for l.pos < len(l.src) && l.src[l.pos] != '\n' {
				l.advance()
			}
		} else if ch == '/' && l.pos+1 < len(l.src) && l.src[l.pos+1] == '*' {
			// block comment
			l.advance() // /
			l.advance() // *
			for l.pos+1 < len(l.src) {
				if l.src[l.pos] == '*' && l.src[l.pos+1] == '/' {
					l.advance()
					l.advance()
					break
				}
				l.advance()
			}
		} else {
			break
		}
	}
}

func (l *Lexer) next() (Token, error) {
	l.skipWhitespace()

	if l.pos >= len(l.src) {
		return Token{Kind: TokenEOF, Line: l.line, Col: l.col, Offset: l.pos}, nil
	}

	startLine := l.line
	startCol := l.col
	startPos := l.pos
	ch := l.src[l.pos]

	// Number literal
	if ch >= '0' && ch <= '9' {
		return l.scanNumber(startLine, startCol, startPos)
	}

	// String literal
	if ch == '"' || ch == '\'' || ch == '`' {
		return l.scanString(startLine, startCol, startPos, ch)
	}

	// Identifier or keyword
	if isIdentStart(ch) {
		return l.scanIdent(startLine, startCol, startPos)
	}

	// Punctuation and operators
	l.advance()
	switch ch {
	case '(':
		return Token{Kind: TokenLParen, Value: "(", Line: startLine, Col: startCol, Offset: startPos}, nil
	case ')':
		return Token{Kind: TokenRParen, Value: ")", Line: startLine, Col: startCol, Offset: startPos}, nil
	case '{':
		return Token{Kind: TokenLBrace, Value: "{", Line: startLine, Col: startCol, Offset: startPos}, nil
	case '}':
		return Token{Kind: TokenRBrace, Value: "}", Line: startLine, Col: startCol, Offset: startPos}, nil
	case '[':
		return Token{Kind: TokenLBracket, Value: "[", Line: startLine, Col: startCol, Offset: startPos}, nil
	case ']':
		return Token{Kind: TokenRBracket, Value: "]", Line: startLine, Col: startCol, Offset: startPos}, nil
	case ';':
		return Token{Kind: TokenSemicolon, Value: ";", Line: startLine, Col: startCol, Offset: startPos}, nil
	case ':':
		return Token{Kind: TokenColon, Value: ":", Line: startLine, Col: startCol, Offset: startPos}, nil
	case ',':
		return Token{Kind: TokenComma, Value: ",", Line: startLine, Col: startCol, Offset: startPos}, nil
	case '.':
		return Token{Kind: TokenDot, Value: ".", Line: startLine, Col: startCol, Offset: startPos}, nil
	case '~':
		return Token{Kind: TokenTilde, Value: "~", Line: startLine, Col: startCol, Offset: startPos}, nil
	case '+':
		if l.peek() == '+' {
			l.advance()
			return Token{Kind: TokenPlusPlus, Value: "++", Line: startLine, Col: startCol, Offset: startPos}, nil
		}
		return Token{Kind: TokenPlus, Value: "+", Line: startLine, Col: startCol, Offset: startPos}, nil
	case '-':
		if l.peek() == '-' {
			l.advance()
			return Token{Kind: TokenMinusMinus, Value: "--", Line: startLine, Col: startCol, Offset: startPos}, nil
		}
		return Token{Kind: TokenMinus, Value: "-", Line: startLine, Col: startCol, Offset: startPos}, nil
	case '*':
		return Token{Kind: TokenStar, Value: "*", Line: startLine, Col: startCol, Offset: startPos}, nil
	case '/':
		return Token{Kind: TokenSlash, Value: "/", Line: startLine, Col: startCol, Offset: startPos}, nil
	case '%':
		return Token{Kind: TokenPercent, Value: "%", Line: startLine, Col: startCol, Offset: startPos}, nil
	case '=':
		if l.peek() == '=' {
			l.advance()
			if l.peek() == '=' {
				l.advance()
				return Token{Kind: TokenEqEq, Value: "===", Line: startLine, Col: startCol, Offset: startPos}, nil
			}
			return Token{Kind: TokenEq, Value: "==", Line: startLine, Col: startCol, Offset: startPos}, nil
		}
		return Token{Kind: TokenAssign, Value: "=", Line: startLine, Col: startCol, Offset: startPos}, nil
	case '!':
		if l.peek() == '=' {
			l.advance()
			if l.peek() == '=' {
				l.advance()
				return Token{Kind: TokenNeqEq, Value: "!==", Line: startLine, Col: startCol, Offset: startPos}, nil
			}
			return Token{Kind: TokenNeq, Value: "!=", Line: startLine, Col: startCol, Offset: startPos}, nil
		}
		return Token{Kind: TokenBang, Value: "!", Line: startLine, Col: startCol, Offset: startPos}, nil
	case '<':
		if l.peek() == '=' {
			l.advance()
			return Token{Kind: TokenLte, Value: "<=", Line: startLine, Col: startCol, Offset: startPos}, nil
		}
		return Token{Kind: TokenLt, Value: "<", Line: startLine, Col: startCol, Offset: startPos}, nil
	case '>':
		if l.peek() == '=' {
			l.advance()
			return Token{Kind: TokenGte, Value: ">=", Line: startLine, Col: startCol, Offset: startPos}, nil
		}
		return Token{Kind: TokenGt, Value: ">", Line: startLine, Col: startCol, Offset: startPos}, nil
	case '&':
		if l.peek() == '&' {
			l.advance()
			return Token{Kind: TokenAnd, Value: "&&", Line: startLine, Col: startCol, Offset: startPos}, nil
		}
		return Token{}, fmt.Errorf("%d:%d: unexpected character '&'", startLine, startCol)
	case '|':
		if l.peek() == '|' {
			l.advance()
			return Token{Kind: TokenOr, Value: "||", Line: startLine, Col: startCol, Offset: startPos}, nil
		}
		return Token{}, fmt.Errorf("%d:%d: unexpected character '|'", startLine, startCol)
	}

	return Token{}, fmt.Errorf("%d:%d: unexpected character '%c'", startLine, startCol, ch)
}

func (l *Lexer) scanNumber(line, col, start int) (Token, error) {
	for l.pos < len(l.src) && (l.src[l.pos] >= '0' && l.src[l.pos] <= '9') {
		l.advance()
	}
	// Decimal point
	if l.pos < len(l.src) && l.src[l.pos] == '.' {
		l.advance()
		for l.pos < len(l.src) && (l.src[l.pos] >= '0' && l.src[l.pos] <= '9') {
			l.advance()
		}
	}
	val := string(l.src[start:l.pos])
	return Token{Kind: TokenNumber, Value: val, Line: line, Col: col, Offset: start}, nil
}

func (l *Lexer) scanString(line, col, start int, quote byte) (Token, error) {
	l.advance() // opening quote
	for l.pos < len(l.src) && l.src[l.pos] != quote {
		if l.src[l.pos] == '\\' {
			l.advance() // skip escape char
		}
		l.advance()
	}
	if l.pos >= len(l.src) {
		return Token{}, fmt.Errorf("%d:%d: unterminated string", line, col)
	}
	l.advance() // closing quote
	// Value includes the quotes
	val := string(l.src[start:l.pos])
	return Token{Kind: TokenString, Value: val, Line: line, Col: col, Offset: start}, nil
}

func (l *Lexer) scanIdent(line, col, start int) (Token, error) {
	for l.pos < len(l.src) && isIdentPart(l.src[l.pos]) {
		l.advance()
	}
	val := string(l.src[start:l.pos])
	kind := LookupKeyword(val)
	return Token{Kind: kind, Value: val, Line: line, Col: col, Offset: start}, nil
}

func isIdentStart(ch byte) bool {
	return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch == '_' || ch == '$' || ch > 127 && unicode.IsLetter(rune(ch))
}

func isIdentPart(ch byte) bool {
	return isIdentStart(ch) || (ch >= '0' && ch <= '9')
}
