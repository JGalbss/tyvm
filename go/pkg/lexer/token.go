package lexer

// TokenKind identifies the type of a lexical token.
type TokenKind int

const (
	// Literals & identifiers
	TokenEOF TokenKind = iota
	TokenIdent
	TokenNumber  // integer or float literal
	TokenString  // "..." string literal
	TokenBoolean // true / false

	// Punctuation
	TokenLParen    // (
	TokenRParen    // )
	TokenLBrace    // {
	TokenRBrace    // }
	TokenLBracket  // [
	TokenRBracket  // ]
	TokenSemicolon // ;
	TokenColon     // :
	TokenComma     // ,
	TokenDot       // .

	// Operators
	TokenPlus     // +
	TokenMinus    // -
	TokenStar     // *
	TokenSlash    // /
	TokenPercent  // %
	TokenAssign   // =
	TokenEq       // ==
	TokenEqEq     // ===
	TokenNeq      // !=
	TokenNeqEq    // !==
	TokenLt       // <
	TokenGt       // >
	TokenLte      // <=
	TokenGte      // >=
	TokenAnd      // &&
	TokenOr       // ||
	TokenBang     // !
	TokenTilde    // ~
	TokenPlusPlus // ++
	TokenMinusMinus // --

	// Keywords
	TokenLet
	TokenConst
	TokenVar
	TokenFunction
	TokenReturn
	TokenIf
	TokenElse
	TokenWhile
	TokenFor
	TokenClass
	TokenNew
	TokenExport
	TokenImport
	TokenFrom
	TokenAs
	TokenTrue
	TokenFalse
	TokenNull
	TokenConsole
)

// Token represents a single lexical token.
type Token struct {
	Kind    TokenKind
	Value   string // the raw text of the token
	Line    int
	Col     int
	Offset  int
}

var keywords = map[string]TokenKind{
	"let":      TokenLet,
	"const":    TokenConst,
	"var":      TokenVar,
	"function": TokenFunction,
	"return":   TokenReturn,
	"if":       TokenIf,
	"else":     TokenElse,
	"while":    TokenWhile,
	"for":      TokenFor,
	"class":    TokenClass,
	"new":      TokenNew,
	"export":   TokenExport,
	"import":   TokenImport,
	"from":     TokenFrom,
	"as":       TokenAs,
	"true":     TokenTrue,
	"false":    TokenFalse,
	"null":     TokenNull,
	"console":  TokenConsole,
}

// LookupKeyword returns the keyword TokenKind for s, or TokenIdent if s is not a keyword.
func LookupKeyword(s string) TokenKind {
	if k, ok := keywords[s]; ok {
		return k
	}
	return TokenIdent
}
