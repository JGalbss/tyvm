// Package emitter converts IR modules into JVM .class file bytes.
package emitter

import (
	"fmt"

	"github.com/tyvm/tyvm/pkg/classfile"
	"github.com/tyvm/tyvm/pkg/ir"
)

// EmitResult holds a compiled class file.
type EmitResult struct {
	ClassName string
	Bytes     []byte
}

// locals tracks local variable name -> slot index.
type locals struct {
	slots map[string]int
	next  int
}

func newLocals() *locals {
	return &locals{slots: make(map[string]int)}
}

func (l *locals) get(name string) int {
	if idx, ok := l.slots[name]; ok {
		return idx
	}
	return -1
}

func (l *locals) declare(name string, t ir.JvmType) int {
	idx := l.next
	l.slots[name] = idx
	l.next += ir.SlotSize(t)
	return idx
}

type emitCtx struct {
	w          *classfile.ClassWriter
	m          *classfile.MethodBuilder
	locals     *locals
	className  string
	funcs      map[string]*ir.FunctionDef
	returnType ir.JvmType // current function's return type
}

// Emit compiles an IR module to class file bytes.
func Emit(mod *ir.Module) []EmitResult {
	w := classfile.NewClassWriter()
	className := mod.Name

	w.SetClass(classfile.AccPublic|classfile.AccSuper, className, "java/lang/Object")

	// Index functions
	funcs := map[string]*ir.FunctionDef{}
	for _, fn := range mod.Functions {
		funcs[fn.Name] = fn
	}

	// Emit each function as a public static method
	for _, fn := range mod.Functions {
		emitFunction(w, fn, className, funcs)
	}

	return []EmitResult{{ClassName: className, Bytes: w.ToBytes()}}
}

func emitFunction(w *classfile.ClassWriter, fn *ir.FunctionDef, className string, funcs map[string]*ir.FunctionDef) {
	desc := ir.MethodDescriptor(paramTypes(fn.Params), fn.ReturnType)
	mb := w.AddMethod(classfile.AccPublic|classfile.AccStatic, fn.Name, desc)

	loc := newLocals()
	for _, p := range fn.Params {
		loc.declare(p.Name, p.Type)
	}

	ctx := &emitCtx{w: w, m: mb, locals: loc, className: className, funcs: funcs, returnType: fn.ReturnType}

	emitBlock(ctx, fn.Body)

	// Ensure method ends with a return
	switch fn.ReturnType.(type) {
	case ir.TyVoid:
		ctx.m.Emit(classfile.OpRETURN)
	case ir.TyInt:
		// If no explicit return, push 0
		ctx.m.Emit(classfile.OpICONST_0)
		ctx.m.Emit(classfile.OpIRETURN)
	case ir.TyLong:
		ctx.m.Emit(classfile.OpLCONST_0)
		ctx.m.Emit(classfile.OpLRETURN)
	case ir.TyDouble:
		ctx.m.Emit(classfile.OpDCONST_0)
		ctx.m.Emit(classfile.OpDRETURN)
	default:
		ctx.m.Emit(classfile.OpRETURN)
	}

	mb.MaxStack = 64
	mb.MaxLocals = loc.next
	if mb.MaxLocals < 1 {
		mb.MaxLocals = 1
	}
}

func paramTypes(params []ir.Param) []ir.JvmType {
	types := make([]ir.JvmType, len(params))
	for i, p := range params {
		types[i] = p.Type
	}
	return types
}

func emitBlock(ctx *emitCtx, block *ir.Block) {
	if block == nil {
		return
	}
	for _, stmt := range block.Stmts {
		emitStmt(ctx, stmt)
	}
}

func emitStmt(ctx *emitCtx, stmt ir.Stmt) {
	switch s := stmt.(type) {
	case *ir.VarDecl:
		slot := ctx.locals.declare(s.Name, s.DeclType)
		if s.Init != nil {
			emitExpr(ctx, s.Init)
			emitStore(ctx, s.DeclType, slot)
		}

	case *ir.ExprStmt:
		emitExpr(ctx, s.Expr)
		// Pop the value if it produces one and is not void
		if !isVoid(s.Expr) {
			popForType(ctx, s.Expr.Type())
		}

	case *ir.Return:
		if s.Expr != nil {
			emitExpr(ctx, s.Expr)
			// Coerce return value to function's declared return type
			emitCast(ctx, s.Expr.Type(), ctx.returnType)
			switch ctx.returnType.(type) {
			case ir.TyInt, ir.TyBoolean:
				ctx.m.Emit(classfile.OpIRETURN)
			case ir.TyLong:
				ctx.m.Emit(classfile.OpLRETURN)
			case ir.TyDouble:
				ctx.m.Emit(classfile.OpDRETURN)
			case ir.TyString, ir.TyObject, ir.TyArray:
				ctx.m.Emit(classfile.OpARETURN)
			default:
				ctx.m.Emit(classfile.OpRETURN)
			}
		} else {
			ctx.m.Emit(classfile.OpRETURN)
		}

	case *ir.If:
		elseLabel := ctx.m.Label()
		endLabel := ctx.m.Label()
		emitCondBranch(ctx, s.Condition, elseLabel, false)
		emitBlock(ctx, s.Then)
		if s.Else != nil {
			ctx.m.EmitJump(classfile.OpGOTO, endLabel)
		}
		ctx.m.PlaceLabel(elseLabel)
		if s.Else != nil {
			emitBlock(ctx, s.Else)
		}
		ctx.m.PlaceLabel(endLabel)

	case *ir.While:
		topLabel := ctx.m.Label()
		endLabel := ctx.m.Label()
		ctx.m.PlaceLabel(topLabel)
		emitCondBranch(ctx, s.Condition, endLabel, false)
		emitBlock(ctx, s.Body)
		ctx.m.EmitJump(classfile.OpGOTO, topLabel)
		ctx.m.PlaceLabel(endLabel)

	case *ir.For:
		if s.Init != nil {
			emitStmt(ctx, s.Init)
		}
		topLabel := ctx.m.Label()
		endLabel := ctx.m.Label()
		ctx.m.PlaceLabel(topLabel)
		if s.Condition != nil {
			emitCondBranch(ctx, s.Condition, endLabel, false)
		}
		emitBlock(ctx, s.Body)
		if s.Update != nil {
			emitExpr(ctx, s.Update)
			if !isVoid(s.Update) {
				popForType(ctx, s.Update.Type())
			}
		}
		ctx.m.EmitJump(classfile.OpGOTO, topLabel)
		ctx.m.PlaceLabel(endLabel)

	case *ir.Block:
		emitBlock(ctx, s)
	}
}

func emitCondBranch(ctx *emitCtx, cond ir.Expr, targetLabel int, branchOnTrue bool) {
	// Optimize: if cond is a comparison, use IF_ICMP* directly
	if bin, ok := cond.(*ir.BinaryOp); ok {
		lt := bin.Left.Type()
		switch lt.(type) {
		case ir.TyInt:
			emitExpr(ctx, bin.Left)
			emitExpr(ctx, bin.Right)
			var op byte
			if branchOnTrue {
				op = intCmpBranchTrue(bin.Op)
			} else {
				op = intCmpBranchFalse(bin.Op)
			}
			ctx.m.EmitJump(op, targetLabel)
			return
		case ir.TyLong:
			emitExpr(ctx, bin.Left)
			emitExpr(ctx, bin.Right)
			ctx.m.Emit(classfile.OpLCMP)
			var op byte
			if branchOnTrue {
				op = zeroCmpBranchTrue(bin.Op)
			} else {
				op = zeroCmpBranchFalse(bin.Op)
			}
			ctx.m.EmitJump(op, targetLabel)
			return
		case ir.TyDouble:
			emitExpr(ctx, bin.Left)
			emitExpr(ctx, bin.Right)
			ctx.m.Emit(classfile.OpDCMPL)
			var op byte
			if branchOnTrue {
				op = zeroCmpBranchTrue(bin.Op)
			} else {
				op = zeroCmpBranchFalse(bin.Op)
			}
			ctx.m.EmitJump(op, targetLabel)
			return
		}
	}

	// Fallback: evaluate to boolean, branch on 0/1
	emitExpr(ctx, cond)
	if branchOnTrue {
		ctx.m.EmitJump(classfile.OpIFNE, targetLabel)
	} else {
		ctx.m.EmitJump(classfile.OpIFEQ, targetLabel)
	}
}

func intCmpBranchFalse(op string) byte {
	switch op {
	case "<":
		return classfile.OpIF_ICMPGE
	case "<=":
		return classfile.OpIF_ICMPGT
	case ">":
		return classfile.OpIF_ICMPLE
	case ">=":
		return classfile.OpIF_ICMPLT
	case "==":
		return classfile.OpIF_ICMPNE
	case "!=":
		return classfile.OpIF_ICMPEQ
	}
	return classfile.OpIFEQ
}

func intCmpBranchTrue(op string) byte {
	switch op {
	case "<":
		return classfile.OpIF_ICMPLT
	case "<=":
		return classfile.OpIF_ICMPLE
	case ">":
		return classfile.OpIF_ICMPGT
	case ">=":
		return classfile.OpIF_ICMPGE
	case "==":
		return classfile.OpIF_ICMPEQ
	case "!=":
		return classfile.OpIF_ICMPNE
	}
	return classfile.OpIFNE
}

func zeroCmpBranchFalse(op string) byte {
	switch op {
	case "<":
		return classfile.OpIFGE
	case "<=":
		return classfile.OpIFGT
	case ">":
		return classfile.OpIFLE
	case ">=":
		return classfile.OpIFLT
	case "==":
		return classfile.OpIFNE
	case "!=":
		return classfile.OpIFEQ
	}
	return classfile.OpIFEQ
}

func zeroCmpBranchTrue(op string) byte {
	switch op {
	case "<":
		return classfile.OpIFLT
	case "<=":
		return classfile.OpIFLE
	case ">":
		return classfile.OpIFGT
	case ">=":
		return classfile.OpIFGE
	case "==":
		return classfile.OpIFEQ
	case "!=":
		return classfile.OpIFNE
	}
	return classfile.OpIFNE
}

func emitExpr(ctx *emitCtx, expr ir.Expr) {
	switch e := expr.(type) {
	case *ir.Const:
		emitConst(ctx, e)

	case *ir.LoadLocal:
		slot := ctx.locals.get(e.Name)
		if slot < 0 {
			panic(fmt.Sprintf("undefined variable: %s", e.Name))
		}
		emitLoad(ctx, e.ExprType, slot)

	case *ir.StoreLocal:
		emitExpr(ctx, e.Val)
		slot := ctx.locals.get(e.Name)
		if slot < 0 {
			slot = ctx.locals.declare(e.Name, e.ExprType)
		}
		emitStore(ctx, e.ExprType, slot)
		// StoreLocal is treated as void -- the value is consumed by the store.
		// If used as an expression (rare), caller must handle the missing value.

	case *ir.BinaryOp:
		emitBinaryOp(ctx, e)

	case *ir.UnaryOp:
		emitExpr(ctx, e.Operand)
		switch e.Op {
		case "-":
			switch e.ExprType.(type) {
			case ir.TyInt:
				ctx.m.Emit(classfile.OpINEG)
			case ir.TyLong:
				ctx.m.Emit(classfile.OpLNEG)
			case ir.TyDouble:
				ctx.m.Emit(classfile.OpDNEG)
			}
		case "!":
			// boolean NOT: XOR with 1
			ctx.m.Emit(classfile.OpICONST_1)
			// IXOR
			ctx.m.Emit(0x82)
		}

	case *ir.Call:
		emitCall(ctx, e)

	case *ir.Cast:
		emitExpr(ctx, e.Inner)
		emitCast(ctx, e.FromType, e.ToType)

	case *ir.StringConcat:
		// Use StringBuilder
		sbClass := "java/lang/StringBuilder"
		newIdx := ctx.w.AddClass(sbClass)
		initIdx := ctx.w.AddMethodref(sbClass, "<init>", "()V")
		ctx.m.Emit(classfile.OpNEW)
		ctx.m.EmitShort(newIdx)
		ctx.m.Emit(classfile.OpDUP)
		ctx.m.Emit(classfile.OpINVOKESPECIAL)
		ctx.m.EmitShort(initIdx)
		for _, part := range e.Parts {
			emitExpr(ctx, part)
			desc := appendDescriptor(part.Type())
			appendIdx := ctx.w.AddMethodref(sbClass, "append", desc)
			ctx.m.Emit(classfile.OpINVOKEVIRTUAL)
			ctx.m.EmitShort(appendIdx)
		}
		toStringIdx := ctx.w.AddMethodref(sbClass, "toString", "()Ljava/lang/String;")
		ctx.m.Emit(classfile.OpINVOKEVIRTUAL)
		ctx.m.EmitShort(toStringIdx)
	}
}

func emitConst(ctx *emitCtx, c *ir.Const) {
	switch v := c.Value.(type) {
	case int64:
		switch c.ExprType.(type) {
		case ir.TyInt:
			emitIntConst(ctx, int(v))
		case ir.TyLong:
			emitLongConst(ctx, v)
		default:
			emitDoubleConst(ctx, float64(v))
		}
	case float64:
		switch c.ExprType.(type) {
		case ir.TyInt:
			emitIntConst(ctx, int(v))
		case ir.TyLong:
			emitLongConst(ctx, int64(v))
		default:
			emitDoubleConst(ctx, v)
		}
	case string:
		idx := ctx.w.AddString(v)
		ctx.m.EmitLdc(idx)
	case bool:
		if v {
			ctx.m.Emit(classfile.OpICONST_1)
		} else {
			ctx.m.Emit(classfile.OpICONST_0)
		}
	case nil:
		ctx.m.Emit(classfile.OpACONST_NULL)
	}
}

func emitIntConst(ctx *emitCtx, v int) {
	if v >= -1 && v <= 5 {
		ctx.m.Emit(byte(classfile.OpICONST_0 + v))
	} else if v >= -128 && v <= 127 {
		ctx.m.Emit(classfile.OpBIPUSH)
		ctx.m.EmitByte(byte(v))
	} else if v >= -32768 && v <= 32767 {
		ctx.m.Emit(classfile.OpSIPUSH)
		ctx.m.EmitShort(v)
	} else {
		idx := ctx.w.AddInteger(int32(v))
		ctx.m.EmitLdc(idx)
	}
}

func emitLongConst(ctx *emitCtx, v int64) {
	if v == 0 {
		ctx.m.Emit(classfile.OpLCONST_0)
	} else if v == 1 {
		ctx.m.Emit(classfile.OpLCONST_1)
	} else {
		idx := ctx.w.AddLong(v)
		ctx.m.Emit(classfile.OpLDC2_W)
		ctx.m.EmitShort(idx)
	}
}

func emitDoubleConst(ctx *emitCtx, v float64) {
	if v == 0 {
		ctx.m.Emit(classfile.OpDCONST_0)
	} else if v == 1 {
		ctx.m.Emit(classfile.OpDCONST_1)
	} else {
		idx := ctx.w.AddDouble(v)
		ctx.m.Emit(classfile.OpLDC2_W)
		ctx.m.EmitShort(idx)
	}
}

func emitLoad(ctx *emitCtx, t ir.JvmType, slot int) {
	switch t.(type) {
	case ir.TyInt, ir.TyBoolean:
		if slot <= 3 {
			ctx.m.Emit(byte(classfile.OpILOAD_0 + slot))
		} else {
			ctx.m.Emit(classfile.OpILOAD)
			ctx.m.EmitByte(byte(slot))
		}
	case ir.TyLong:
		if slot <= 3 {
			ctx.m.Emit(byte(classfile.OpLLOAD_0 + slot))
		} else {
			ctx.m.Emit(classfile.OpLLOAD)
			ctx.m.EmitByte(byte(slot))
		}
	case ir.TyDouble:
		if slot <= 3 {
			ctx.m.Emit(byte(classfile.OpDLOAD_0 + slot))
		} else {
			ctx.m.Emit(classfile.OpDLOAD)
			ctx.m.EmitByte(byte(slot))
		}
	default:
		if slot <= 3 {
			ctx.m.Emit(byte(classfile.OpALOAD_0 + slot))
		} else {
			ctx.m.Emit(classfile.OpALOAD)
			ctx.m.EmitByte(byte(slot))
		}
	}
}

func emitStore(ctx *emitCtx, t ir.JvmType, slot int) {
	switch t.(type) {
	case ir.TyInt, ir.TyBoolean:
		if slot <= 3 {
			ctx.m.Emit(byte(classfile.OpISTORE_0 + slot))
		} else {
			ctx.m.Emit(classfile.OpISTORE)
			ctx.m.EmitByte(byte(slot))
		}
	case ir.TyLong:
		if slot <= 3 {
			ctx.m.Emit(byte(classfile.OpLSTORE_0 + slot))
		} else {
			ctx.m.Emit(classfile.OpLSTORE)
			ctx.m.EmitByte(byte(slot))
		}
	case ir.TyDouble:
		if slot <= 3 {
			ctx.m.Emit(byte(classfile.OpDSTORE_0 + slot))
		} else {
			ctx.m.Emit(classfile.OpDSTORE)
			ctx.m.EmitByte(byte(slot))
		}
	default:
		if slot <= 3 {
			ctx.m.Emit(byte(classfile.OpASTORE_0 + slot))
		} else {
			ctx.m.Emit(classfile.OpASTORE)
			ctx.m.EmitByte(byte(slot))
		}
	}
}

// emitDup is not currently needed since StoreLocal is treated as void.

func emitBinaryOp(ctx *emitCtx, e *ir.BinaryOp) {
	// String concatenation
	if _, ok := e.ExprType.(ir.TyString); ok && e.Op == "+" {
		emitStringConcat2(ctx, e.Left, e.Right)
		return
	}

	emitExpr(ctx, e.Left)
	emitExpr(ctx, e.Right)

	switch e.ExprType.(type) {
	case ir.TyInt:
		switch e.Op {
		case "+":
			ctx.m.Emit(classfile.OpIADD)
		case "-":
			ctx.m.Emit(classfile.OpISUB)
		case "*":
			ctx.m.Emit(classfile.OpIMUL)
		case "/":
			ctx.m.Emit(classfile.OpIDIV)
		case "%":
			ctx.m.Emit(classfile.OpIREM)
		}
	case ir.TyLong:
		switch e.Op {
		case "+":
			ctx.m.Emit(classfile.OpLADD)
		case "-":
			ctx.m.Emit(classfile.OpLSUB)
		case "*":
			ctx.m.Emit(classfile.OpLMUL)
		case "/":
			ctx.m.Emit(classfile.OpLDIV)
		case "%":
			ctx.m.Emit(classfile.OpLREM)
		}
	case ir.TyDouble:
		switch e.Op {
		case "+":
			ctx.m.Emit(classfile.OpDADD)
		case "-":
			ctx.m.Emit(classfile.OpDSUB)
		case "*":
			ctx.m.Emit(classfile.OpDMUL)
		case "/":
			ctx.m.Emit(classfile.OpDDIV)
		case "%":
			ctx.m.Emit(classfile.OpDREM)
		}
	case ir.TyBoolean:
		// Comparison -- emit result as 0/1
		emitComparison(ctx, e)
		return // emitComparison handles it
	}
}

func emitComparison(ctx *emitCtx, e *ir.BinaryOp) {
	// Values already on stack from emitBinaryOp caller... but we double-emitted.
	// Actually emitBinaryOp already emitted left and right. We need to figure out their type.
	lt := e.Left.Type()
	switch lt.(type) {
	case ir.TyInt:
		// Use IF_ICMP* to set 0 or 1
		trueLabel := ctx.m.Label()
		endLabel := ctx.m.Label()
		ctx.m.EmitJump(intCmpBranchTrue(e.Op), trueLabel)
		ctx.m.Emit(classfile.OpICONST_0)
		ctx.m.EmitJump(classfile.OpGOTO, endLabel)
		ctx.m.PlaceLabel(trueLabel)
		ctx.m.Emit(classfile.OpICONST_1)
		ctx.m.PlaceLabel(endLabel)
	case ir.TyLong:
		ctx.m.Emit(classfile.OpLCMP)
		trueLabel := ctx.m.Label()
		endLabel := ctx.m.Label()
		ctx.m.EmitJump(zeroCmpBranchTrue(e.Op), trueLabel)
		ctx.m.Emit(classfile.OpICONST_0)
		ctx.m.EmitJump(classfile.OpGOTO, endLabel)
		ctx.m.PlaceLabel(trueLabel)
		ctx.m.Emit(classfile.OpICONST_1)
		ctx.m.PlaceLabel(endLabel)
	case ir.TyDouble:
		ctx.m.Emit(classfile.OpDCMPL)
		trueLabel := ctx.m.Label()
		endLabel := ctx.m.Label()
		ctx.m.EmitJump(zeroCmpBranchTrue(e.Op), trueLabel)
		ctx.m.Emit(classfile.OpICONST_0)
		ctx.m.EmitJump(classfile.OpGOTO, endLabel)
		ctx.m.PlaceLabel(trueLabel)
		ctx.m.Emit(classfile.OpICONST_1)
		ctx.m.PlaceLabel(endLabel)
	}
}

func emitCall(ctx *emitCtx, call *ir.Call) {
	// Resolve className
	className := call.ClassName
	if className == "" {
		className = ctx.className
	}

	if call.IsStatic {
		// Special case: Rt.println overloads
		if className == "tyvm/runtime/Rt" && call.Target == "println" {
			for _, arg := range call.Args {
				emitExpr(ctx, arg)
			}
			emitPrintln(ctx, call.Args)
			return
		}

		// Look up in module functions for correct param types
		if fn, ok := ctx.funcs[call.Target]; ok && className == ctx.className {
			// Emit args with coercion to match function param types
			for i, arg := range call.Args {
				emitExpr(ctx, arg)
				if i < len(fn.Params) {
					emitCast(ctx, arg.Type(), fn.Params[i].Type)
				}
			}
			desc := ir.MethodDescriptor(paramTypes(fn.Params), fn.ReturnType)
			idx := ctx.w.AddMethodref(className, call.Target, desc)
			ctx.m.Emit(classfile.OpINVOKESTATIC)
			ctx.m.EmitShort(idx)
			return
		}

		// External call: emit args as-is
		for _, arg := range call.Args {
			emitExpr(ctx, arg)
		}
		argTypes := make([]ir.JvmType, len(call.Args))
		for i, a := range call.Args {
			argTypes[i] = a.Type()
		}
		desc := ir.MethodDescriptor(argTypes, call.ReturnType)
		idx := ctx.w.AddMethodref(className, call.Target, desc)
		ctx.m.Emit(classfile.OpINVOKESTATIC)
		ctx.m.EmitShort(idx)
	} else {
		// Instance call -- first arg is the receiver
		for _, arg := range call.Args {
			emitExpr(ctx, arg)
		}
		argTypes := make([]ir.JvmType, len(call.Args)-1)
		for i := 1; i < len(call.Args); i++ {
			argTypes[i-1] = call.Args[i].Type()
		}
		desc := ir.MethodDescriptor(argTypes, call.ReturnType)
		idx := ctx.w.AddMethodref(className, call.Target, desc)
		ctx.m.Emit(classfile.OpINVOKEVIRTUAL)
		ctx.m.EmitShort(idx)
	}
}

func emitPrintln(ctx *emitCtx, args []ir.Expr) {
	// Get System.out
	outIdx := ctx.w.AddFieldref("java/lang/System", "out", "Ljava/io/PrintStream;")
	ctx.m.Emit(classfile.OpGETSTATIC)
	ctx.m.EmitShort(outIdx)

	// Swap: value is already on stack, but we need out below it
	// Actually we need to re-emit: getstatic first, then value, then invokevirtual
	// Let's redo: pop args (already emitted by caller), getstatic, re-push, invoke.
	// Simpler: the caller hasn't emitted args since we intercepted emitCall.
	// Actually emitCall emits args before calling us. Let's fix this by
	// assuming single arg println.

	if len(args) == 0 {
		// println with no args
		printIdx := ctx.w.AddMethodref("java/io/PrintStream", "println", "()V")
		ctx.m.Emit(classfile.OpINVOKEVIRTUAL)
		ctx.m.EmitShort(printIdx)
		return
	}

	// We have: [args...] [System.out] on stack
	// We need: [System.out] [arg] on stack
	// For single arg, we can SWAP
	arg := args[0]
	switch arg.Type().(type) {
	case ir.TyInt:
		ctx.m.Emit(0x5f) // SWAP
		printIdx := ctx.w.AddMethodref("java/io/PrintStream", "println", "(I)V")
		ctx.m.Emit(classfile.OpINVOKEVIRTUAL)
		ctx.m.EmitShort(printIdx)
	case ir.TyLong:
		// long is 2 slots, need DUP_X2 trick. Simpler: restructure.
		// Actually let's just use Rt.println
		rtIdx := ctx.w.AddMethodref("tyvm/runtime/Rt", "println", "(J)V")
		ctx.m.Emit(classfile.OpPOP) // pop System.out
		ctx.m.Emit(classfile.OpINVOKESTATIC)
		ctx.m.EmitShort(rtIdx)
	case ir.TyDouble:
		rtIdx := ctx.w.AddMethodref("tyvm/runtime/Rt", "println", "(D)V")
		ctx.m.Emit(classfile.OpPOP) // pop System.out
		ctx.m.Emit(classfile.OpINVOKESTATIC)
		ctx.m.EmitShort(rtIdx)
	case ir.TyString:
		ctx.m.Emit(0x5f) // SWAP
		printIdx := ctx.w.AddMethodref("java/io/PrintStream", "println", "(Ljava/lang/String;)V")
		ctx.m.Emit(classfile.OpINVOKEVIRTUAL)
		ctx.m.EmitShort(printIdx)
	default:
		ctx.m.Emit(0x5f) // SWAP
		printIdx := ctx.w.AddMethodref("java/io/PrintStream", "println", "(Ljava/lang/Object;)V")
		ctx.m.Emit(classfile.OpINVOKEVIRTUAL)
		ctx.m.EmitShort(printIdx)
	}
}

func emitCast(ctx *emitCtx, from, to ir.JvmType) {
	if from.Descriptor() == to.Descriptor() {
		return
	}
	switch from.(type) {
	case ir.TyInt:
		switch to.(type) {
		case ir.TyLong:
			ctx.m.Emit(classfile.OpI2L)
		case ir.TyDouble:
			ctx.m.Emit(classfile.OpI2D)
		}
	case ir.TyLong:
		switch to.(type) {
		case ir.TyInt:
			ctx.m.Emit(classfile.OpL2I)
		case ir.TyDouble:
			ctx.m.Emit(classfile.OpL2D)
		}
	case ir.TyDouble:
		switch to.(type) {
		case ir.TyInt:
			ctx.m.Emit(classfile.OpD2I)
		case ir.TyLong:
			ctx.m.Emit(classfile.OpD2L)
		}
	}
}

func emitStringConcat2(ctx *emitCtx, left, right ir.Expr) {
	sbClass := "java/lang/StringBuilder"
	newIdx := ctx.w.AddClass(sbClass)
	initIdx := ctx.w.AddMethodref(sbClass, "<init>", "()V")

	ctx.m.Emit(classfile.OpNEW)
	ctx.m.EmitShort(newIdx)
	ctx.m.Emit(classfile.OpDUP)
	ctx.m.Emit(classfile.OpINVOKESPECIAL)
	ctx.m.EmitShort(initIdx)

	emitExpr(ctx, left)
	appendIdx := ctx.w.AddMethodref(sbClass, "append", appendDescriptor(left.Type()))
	ctx.m.Emit(classfile.OpINVOKEVIRTUAL)
	ctx.m.EmitShort(appendIdx)

	emitExpr(ctx, right)
	appendIdx2 := ctx.w.AddMethodref(sbClass, "append", appendDescriptor(right.Type()))
	ctx.m.Emit(classfile.OpINVOKEVIRTUAL)
	ctx.m.EmitShort(appendIdx2)

	toStringIdx := ctx.w.AddMethodref(sbClass, "toString", "()Ljava/lang/String;")
	ctx.m.Emit(classfile.OpINVOKEVIRTUAL)
	ctx.m.EmitShort(toStringIdx)
}

func appendDescriptor(t ir.JvmType) string {
	switch t.(type) {
	case ir.TyInt:
		return "(I)Ljava/lang/StringBuilder;"
	case ir.TyLong:
		return "(J)Ljava/lang/StringBuilder;"
	case ir.TyDouble:
		return "(D)Ljava/lang/StringBuilder;"
	case ir.TyBoolean:
		return "(Z)Ljava/lang/StringBuilder;"
	case ir.TyString:
		return "(Ljava/lang/String;)Ljava/lang/StringBuilder;"
	default:
		return "(Ljava/lang/Object;)Ljava/lang/StringBuilder;"
	}
}

func isVoid(e ir.Expr) bool {
	if c, ok := e.(*ir.Call); ok {
		_, isVoid := c.ReturnType.(ir.TyVoid)
		return isVoid
	}
	_, isStore := e.(*ir.StoreLocal)
	return isStore
}

func popForType(ctx *emitCtx, t ir.JvmType) {
	switch t.(type) {
	case ir.TyLong, ir.TyDouble:
		ctx.m.Emit(classfile.OpPOP2)
	case ir.TyVoid:
		// nothing
	default:
		ctx.m.Emit(classfile.OpPOP)
	}
}

