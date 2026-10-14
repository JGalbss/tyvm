package ir

import "math"

// IntPromote rewrites the module in-place, promoting double variables that are
// provably integer-valued to TyInt or TyLong for better JVM performance.
func IntPromote(mod *Module) {
	for _, fn := range mod.Functions {
		promoteFunction(fn)
	}
}

type varInfo struct {
	assignments      []Expr
	usedInDivision   bool
	isAccumulator    bool
	accumBounded     bool // all accumulated terms are small constants
	isLoopCounter    bool
}

func promoteFunction(fn *FunctionDef) {
	vars := analyzeVars(fn)
	promos := map[string]JvmType{}

	// Seed with params that are already int/long
	for _, p := range fn.Params {
		switch p.Type.(type) {
		case TyInt, TyLong:
			promos[p.Name] = p.Type
		}
	}

	paramNames := map[string]bool{}
	for _, p := range fn.Params {
		paramNames[p.Name] = true
	}

	for name, info := range vars {
		if _, ok := promos[name]; ok {
			continue
		}
		if paramNames[name] {
			continue
		}
		if t := chooseType(info); t != nil {
			promos[name] = t
		}
	}

	if len(promos) == 0 {
		return
	}

	fn.Body = rewriteBlock(fn.Body, promos)
}

func chooseType(info *varInfo) JvmType {
	if len(info.assignments) == 0 {
		return nil
	}
	if info.usedInDivision {
		return nil
	}
	// Loop counters -> always int (safe for counters up to 2B)
	if info.isLoopCounter {
		return TyInt{}
	}
	// Accumulators: check if init is integer, then promote.
	// The accumulated terms might be LoadLocal vars that are also being promoted
	// (chicken-and-egg), so we check if the accumulated terms are integer-valued
	// OR are LoadLocals (which might be promoted to int).
	if info.isAccumulator {
		hasIntInit := len(info.assignments) > 0 && isIntegerExpr(info.assignments[0])
		if !hasIntInit {
			return nil
		}
		// Check if all accumulated terms are likely integer: either already integer,
		// or LoadLocal (will be promoted), or a Call returning double (NOT integer).
		for _, a := range info.assignments[1:] {
			if bin, ok := a.(*BinaryOp); ok && (bin.Op == "+" || bin.Op == "-") {
				if isCallReturningDouble(bin.Right) {
					return nil // accumulated term is a function call returning double
				}
			}
		}
		if info.accumBounded {
			return TyInt{}
		}
		return TyLong{}
	}
	// General case: all assignments must be integer
	allInt := true
	for _, e := range info.assignments {
		if !isIntegerExpr(e) {
			allInt = false
			break
		}
	}
	if !allInt {
		return nil
	}
	return TyInt{}
}

// isCallReturningDouble checks if an expression is a function call returning double.
func isCallReturningDouble(e Expr) bool {
	if c, ok := e.(*Call); ok {
		if _, isDouble := c.ReturnType.(TyDouble); isDouble {
			return true
		}
	}
	return false
}

// isIntegerExprOrLocalRef checks if an expression is provably integer-valued.
// A LoadLocal with double type is NOT considered integer (unlike isIntegerExpr for
// constants and explicitly-typed locals).
func isIntegerExprOrLocalRef(e Expr) bool {
	switch v := e.(type) {
	case *Const:
		switch n := v.Value.(type) {
		case int64:
			return true
		case float64:
			return n == math.Trunc(n)
		}
	case *LoadLocal:
		switch v.ExprType.(type) {
		case TyInt, TyLong:
			return true
		}
	case *BinaryOp:
		return isIntegerExprOrLocalRef(v.Left) && isIntegerExprOrLocalRef(v.Right)
	case *Call:
		switch v.ReturnType.(type) {
		case TyInt, TyLong:
			return true
		}
	}
	return false
}

func isIntegerExpr(e Expr) bool {
	switch v := e.(type) {
	case *Const:
		switch n := v.Value.(type) {
		case int64:
			return true
		case float64:
			return n == math.Trunc(n)
		}
	case *BinaryOp:
		return isIntegerExpr(v.Left) && isIntegerExpr(v.Right)
	case *UnaryOp:
		return isIntegerExpr(v.Operand)
	case *LoadLocal:
		switch v.ExprType.(type) {
		case TyInt, TyLong:
			return true
		}
	}
	return false
}

func analyzeVars(fn *FunctionDef) map[string]*varInfo {
	vars := map[string]*varInfo{}
	ensure := func(name string) *varInfo {
		if v, ok := vars[name]; ok {
			return v
		}
		v := &varInfo{accumBounded: true}
		vars[name] = v
		return v
	}

	var analyzeExpr func(Expr)
	analyzeExpr = func(e Expr) {
		if e == nil {
			return
		}
		switch v := e.(type) {
		case *BinaryOp:
			if v.Op == "/" {
				markDivision(v.Left, ensure)
				markDivision(v.Right, ensure)
			}
			analyzeExpr(v.Left)
			analyzeExpr(v.Right)
		case *UnaryOp:
			analyzeExpr(v.Operand)
		case *StoreLocal:
			info := ensure(v.Name)
			info.assignments = append(info.assignments, v.Val)
			// Check accumulator pattern: x = x + expr
			if bin, ok := v.Val.(*BinaryOp); ok && (bin.Op == "+" || bin.Op == "-") {
				if ld, ok := bin.Left.(*LoadLocal); ok && ld.Name == v.Name {
					info.isAccumulator = true
					if !isBoundedInt(bin.Right) {
						info.accumBounded = false
					}
				}
			}
			analyzeExpr(v.Val)
		case *Call:
			for _, a := range v.Args {
				analyzeExpr(a)
			}
		case *StringConcat:
			for _, p := range v.Parts {
				analyzeExpr(p)
			}
		}
	}

	var analyzeBlockFn func(*Block)
	var analyzeStmt func(Stmt)

	analyzeBlockFn = func(b *Block) {
		if b == nil {
			return
		}
		for _, s := range b.Stmts {
			analyzeStmt(s)
		}
	}

	analyzeStmt = func(s Stmt) {
		if s == nil {
			return
		}
		switch v := s.(type) {
		case *VarDecl:
			info := ensure(v.Name)
			if v.Init != nil {
				info.assignments = append(info.assignments, v.Init)
				analyzeExpr(v.Init)
			}
		case *ExprStmt:
			analyzeExpr(v.Expr)
		case *Return:
			analyzeExpr(v.Expr)
		case *If:
			analyzeExpr(v.Condition)
			analyzeBlockFn(v.Then)
			analyzeBlockFn(v.Else)
		case *While:
			analyzeExpr(v.Condition)
			analyzeBlockFn(v.Body)
			detectLoopCounter(v.Condition, v.Body, ensure)
		case *For:
			analyzeStmt(v.Init)
			analyzeExpr(v.Condition)
			analyzeExpr(v.Update)
			analyzeBlockFn(v.Body)
		case *Block:
			analyzeBlockFn(v)
		}
	}

	analyzeBlockFn(fn.Body)

	return vars
}

func analyzeBlock(b *Block, analyzeStmt func(Stmt)) {
	if b == nil {
		return
	}
	for _, s := range b.Stmts {
		analyzeStmt(s)
	}
}

func markDivision(e Expr, ensure func(string) *varInfo) {
	if ld, ok := e.(*LoadLocal); ok {
		ensure(ld.Name).usedInDivision = true
	}
}

func isBoundedInt(e Expr) bool {
	if c, ok := e.(*Const); ok {
		switch n := c.Value.(type) {
		case int64:
			return n >= -1000 && n <= 1000
		case float64:
			return n == math.Trunc(n) && math.Abs(n) <= 1000
		}
	}
	return false
}

func detectLoopCounter(cond Expr, body *Block, ensure func(string) *varInfo) {
	bin, ok := cond.(*BinaryOp)
	if !ok {
		return
	}
	ld, ok := bin.Left.(*LoadLocal)
	if !ok {
		return
	}
	counterName := ld.Name

	if body == nil {
		return
	}
	for _, s := range body.Stmts {
		es, ok := s.(*ExprStmt)
		if !ok {
			continue
		}
		st, ok := es.Expr.(*StoreLocal)
		if !ok || st.Name != counterName {
			continue
		}
		if b, ok := st.Val.(*BinaryOp); ok && (b.Op == "+" || b.Op == "-") {
			if l, ok := b.Left.(*LoadLocal); ok && l.Name == counterName {
				if c, ok := b.Right.(*Const); ok {
					if _, ok := c.Value.(int64); ok {
						ensure(counterName).isLoopCounter = true
					} else if f, ok := c.Value.(float64); ok && f == math.Trunc(f) {
						ensure(counterName).isLoopCounter = true
					}
				}
			}
		}
	}
}

// --- Rewriting ---

func rewriteBlock(b *Block, promos map[string]JvmType) *Block {
	if b == nil {
		return nil
	}
	stmts := make([]Stmt, len(b.Stmts))
	for i, s := range b.Stmts {
		stmts[i] = rewriteStmt(s, promos)
	}
	return &Block{Stmts: stmts}
}

func rewriteStmt(s Stmt, promos map[string]JvmType) Stmt {
	switch v := s.(type) {
	case *VarDecl:
		newType := v.DeclType
		if t, ok := promos[v.Name]; ok {
			newType = t
		}
		var init Expr
		if v.Init != nil {
			init = rewriteExpr(v.Init, promos)
			init = coerce(init, newType, promos)
		}
		return &VarDecl{Name: v.Name, DeclType: newType, Init: init}
	case *ExprStmt:
		return &ExprStmt{Expr: rewriteExpr(v.Expr, promos)}
	case *Return:
		if v.Expr != nil {
			return &Return{Expr: rewriteExpr(v.Expr, promos)}
		}
		return v
	case *If:
		return &If{
			Condition: rewriteExpr(v.Condition, promos),
			Then:      rewriteBlock(v.Then, promos),
			Else:      rewriteBlock(v.Else, promos),
		}
	case *While:
		return &While{
			Condition: rewriteExpr(v.Condition, promos),
			Body:      rewriteBlock(v.Body, promos),
		}
	case *For:
		var init Stmt
		if v.Init != nil {
			init = rewriteStmt(v.Init, promos)
		}
		var cond, update Expr
		if v.Condition != nil {
			cond = rewriteExpr(v.Condition, promos)
		}
		if v.Update != nil {
			update = rewriteExpr(v.Update, promos)
		}
		return &For{
			Init:      init,
			Condition: cond,
			Update:    update,
			Body:      rewriteBlock(v.Body, promos),
		}
	case *Block:
		return rewriteBlock(v, promos)
	}
	return s
}

func rewriteExpr(e Expr, promos map[string]JvmType) Expr {
	if e == nil {
		return nil
	}
	switch v := e.(type) {
	case *LoadLocal:
		if t, ok := promos[v.Name]; ok {
			return &LoadLocal{Name: v.Name, ExprType: t}
		}
		return v
	case *StoreLocal:
		val := rewriteExpr(v.Val, promos)
		targetType := v.ExprType
		if t, ok := promos[v.Name]; ok {
			targetType = t
		}
		return &StoreLocal{Name: v.Name, Val: coerce(val, targetType, promos), ExprType: targetType}
	case *BinaryOp:
		left := rewriteExpr(v.Left, promos)
		right := rewriteExpr(v.Right, promos)
		lt := exprTypeWithPromos(left, promos)
		rt := exprTypeWithPromos(right, promos)
		if isIntJvmType(lt) && isIntJvmType(rt) && isIntArithOp(v.Op) {
			if isCompOp(v.Op) {
				wider := widerInt(lt, rt)
				return &BinaryOp{
					Op: v.Op, Left: coerce(left, wider, promos),
					Right: coerce(right, wider, promos), ExprType: TyBoolean{},
				}
			}
			wider := widerInt(lt, rt)
			return &BinaryOp{
				Op: v.Op, Left: coerce(left, wider, promos),
				Right: coerce(right, wider, promos), ExprType: wider,
			}
		}
		// Mixed int/double: widen int side to double
		_, ltIsDouble := lt.(TyDouble)
		_, rtIsDouble := rt.(TyDouble)
		if isIntJvmType(lt) && rtIsDouble {
			return &BinaryOp{Op: v.Op, Left: coerce(left, TyDouble{}, promos), Right: right, ExprType: TyDouble{}}
		}
		if ltIsDouble && isIntJvmType(rt) {
			return &BinaryOp{Op: v.Op, Left: left, Right: coerce(right, TyDouble{}, promos), ExprType: TyDouble{}}
		}
		return &BinaryOp{Op: v.Op, Left: left, Right: right, ExprType: v.ExprType}
	case *UnaryOp:
		operand := rewriteExpr(v.Operand, promos)
		return &UnaryOp{Op: v.Op, Operand: operand, ExprType: operand.Type()}
	case *Call:
		args := make([]Expr, len(v.Args))
		for i, a := range v.Args {
			args[i] = rewriteExpr(a, promos)
		}
		return &Call{Target: v.Target, ClassName: v.ClassName, Args: args, ReturnType: v.ReturnType, IsStatic: v.IsStatic}
	case *Const:
		return v
	}
	return e
}

func exprTypeWithPromos(e Expr, promos map[string]JvmType) JvmType {
	if ld, ok := e.(*LoadLocal); ok {
		if t, ok := promos[ld.Name]; ok {
			return t
		}
	}
	if c, ok := e.(*Const); ok {
		if n, ok := c.Value.(int64); ok {
			_ = n
			return TyInt{}
		}
		if f, ok := c.Value.(float64); ok && f == math.Trunc(f) {
			return TyInt{}
		}
	}
	return e.Type()
}

func isIntJvmType(t JvmType) bool {
	switch t.(type) {
	case TyInt, TyLong:
		return true
	}
	return false
}

func isIntArithOp(op string) bool {
	switch op {
	case "+", "-", "*", "/", "%", "==", "!=", "<", ">", "<=", ">=":
		return true
	}
	return false
}

func isCompOp(op string) bool {
	switch op {
	case "==", "!=", "<", ">", "<=", ">=":
		return true
	}
	return false
}

func widerInt(a, b JvmType) JvmType {
	if _, ok := a.(TyLong); ok {
		return TyLong{}
	}
	if _, ok := b.(TyLong); ok {
		return TyLong{}
	}
	return TyInt{}
}

func coerce(e Expr, target JvmType, promos map[string]JvmType) Expr {
	// Integer constant: just change the type tag on the Const node directly
	if c, ok := e.(*Const); ok {
		switch c.Value.(type) {
		case int64, float64:
			return &Const{Value: c.Value, ExprType: target}
		}
	}
	actual := exprTypeWithPromos(e, promos)
	if sameType(actual, target) {
		return e
	}
	return &Cast{Inner: e, FromType: actual, ToType: target}
}

func sameType(a, b JvmType) bool {
	return a.Descriptor() == b.Descriptor()
}
