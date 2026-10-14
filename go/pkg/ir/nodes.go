package ir

// JvmType represents a JVM type in the IR.
type JvmType interface {
	jvmType()
	Descriptor() string
}

type TyVoid struct{}
type TyBoolean struct{}
type TyInt struct{}
type TyLong struct{}
type TyFloat struct{}
type TyDouble struct{}
type TyString struct{}
type TyArray struct{ ElementType JvmType }
type TyObject struct{ ClassName string }

func (TyVoid) jvmType()    {}
func (TyBoolean) jvmType() {}
func (TyInt) jvmType()     {}
func (TyLong) jvmType()    {}
func (TyFloat) jvmType()   {}
func (TyDouble) jvmType()  {}
func (TyString) jvmType()  {}
func (TyArray) jvmType()   {}
func (TyObject) jvmType()  {}

func (TyVoid) Descriptor() string    { return "V" }
func (TyBoolean) Descriptor() string { return "Z" }
func (TyInt) Descriptor() string     { return "I" }
func (TyLong) Descriptor() string    { return "J" }
func (TyFloat) Descriptor() string   { return "F" }
func (TyDouble) Descriptor() string  { return "D" }
func (TyString) Descriptor() string  { return "Ljava/lang/String;" }
func (t TyArray) Descriptor() string { return "[" + t.ElementType.Descriptor() }
func (t TyObject) Descriptor() string {
	return "L" + t.ClassName + ";"
}

// SlotSize returns the number of local variable slots the type occupies.
func SlotSize(t JvmType) int {
	switch t.(type) {
	case TyLong, TyDouble:
		return 2
	default:
		return 1
	}
}

// MethodDescriptor builds a JVM method descriptor string.
func MethodDescriptor(params []JvmType, ret JvmType) string {
	s := "("
	for _, p := range params {
		s += p.Descriptor()
	}
	s += ")" + ret.Descriptor()
	return s
}

// --- Expressions ---

type Expr interface {
	exprNode()
	Type() JvmType
}

type Const struct {
	Value    interface{} // int64, float64, string, bool, or nil
	ExprType JvmType
}

type LoadLocal struct {
	Name     string
	ExprType JvmType
}

type StoreLocal struct {
	Name     string
	Val      Expr
	ExprType JvmType
}

type BinaryOp struct {
	Op       string // "+", "-", "*", "/", "%", "==", "!=", "<", ">", "<=", ">=", "&&", "||"
	Left     Expr
	Right    Expr
	ExprType JvmType
}

type UnaryOp struct {
	Op       string // "-", "!", "~"
	Operand  Expr
	ExprType JvmType
}

type Call struct {
	Target     string
	ClassName  string
	Args       []Expr
	ReturnType JvmType
	IsStatic   bool
}

type NewObject struct {
	ClassName string
	Args      []Expr
}

type ArrayNew struct {
	ElemType JvmType
	Size     Expr
}

type ArrayGet struct {
	Array    Expr
	Index    Expr
	ExprType JvmType
}

type ArraySet struct {
	Array Expr
	Index Expr
	Value Expr
}

type Cast struct {
	Inner    Expr
	FromType JvmType
	ToType   JvmType
}

type StringConcat struct {
	Parts []Expr
}

func (Const) exprNode()        {}
func (LoadLocal) exprNode()    {}
func (StoreLocal) exprNode()   {}
func (BinaryOp) exprNode()     {}
func (UnaryOp) exprNode()      {}
func (Call) exprNode()         {}
func (NewObject) exprNode()    {}
func (ArrayNew) exprNode()     {}
func (ArrayGet) exprNode()     {}
func (ArraySet) exprNode()     {}
func (Cast) exprNode()         {}
func (StringConcat) exprNode() {}

func (e *Const) Type() JvmType        { return e.ExprType }
func (e *LoadLocal) Type() JvmType    { return e.ExprType }
func (e *StoreLocal) Type() JvmType   { return e.ExprType }
func (e *BinaryOp) Type() JvmType     { return e.ExprType }
func (e *UnaryOp) Type() JvmType      { return e.ExprType }
func (e *Call) Type() JvmType         { return e.ReturnType }
func (e *NewObject) Type() JvmType    { return TyObject{ClassName: e.ClassName} }
func (e *ArrayNew) Type() JvmType     { return TyArray{ElementType: e.ElemType} }
func (e *ArrayGet) Type() JvmType     { return e.ExprType }
func (e *ArraySet) Type() JvmType     { return TyVoid{} }
func (e *Cast) Type() JvmType         { return e.ToType }
func (e *StringConcat) Type() JvmType { return TyString{} }

// --- Statements ---

type Stmt interface {
	stmtNode()
}

type ExprStmt struct{ Expr Expr }
type VarDecl struct {
	Name     string
	DeclType JvmType
	Init     Expr // nil if no initializer
}
type Return struct{ Expr Expr } // Expr may be nil
type If struct {
	Condition Expr
	Then      *Block
	Else      *Block // nil if no else
}
type While struct {
	Condition Expr
	Body      *Block
}
type For struct {
	Init      Stmt // nil if none
	Condition Expr // nil if none
	Update    Expr // nil if none
	Body      *Block
}
type Block struct {
	Stmts []Stmt
}

func (ExprStmt) stmtNode() {}
func (VarDecl) stmtNode()  {}
func (Return) stmtNode()   {}
func (If) stmtNode()       {}
func (While) stmtNode()    {}
func (For) stmtNode()      {}
func (Block) stmtNode()    {}

// --- Top-level ---

type Param struct {
	Name string
	Type JvmType
}

type FunctionDef struct {
	Name       string
	Params     []Param
	ReturnType JvmType
	Body       *Block
	IsExported bool
}

type Module struct {
	Name      string
	Functions []*FunctionDef
}
