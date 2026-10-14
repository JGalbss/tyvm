// ============================================================================
// IR Node Definitions for tyvm (TypeScript -> JVM compiler)
//
// A simple, explicit intermediate representation designed for straightforward
// lowering to JVM bytecode.
// ============================================================================

// ---------------------------------------------------------------------------
// JVM-oriented Types
// ---------------------------------------------------------------------------

export interface TyVoid {
  kind: "TyVoid";
}

export interface TyBoolean {
  kind: "TyBoolean";
}

export interface TyInt {
  kind: "TyInt";
}

export interface TyLong {
  kind: "TyLong";
}

export interface TyFloat {
  kind: "TyFloat";
}

export interface TyDouble {
  kind: "TyDouble";
}

export interface TyString {
  kind: "TyString";
}

export interface TyArray {
  kind: "TyArray";
  elementType: JvmType;
}

export interface TyObject {
  kind: "TyObject";
  className: string;
}

export interface TyTask {
  kind: "TyTask";
  resultType: JvmType;
}

export interface TyChannel {
  kind: "TyChannel";
  elementType: JvmType;
}

export type JvmType =
  | TyVoid
  | TyBoolean
  | TyInt
  | TyLong
  | TyFloat
  | TyDouble
  | TyString
  | TyArray
  | TyObject
  | TyTask
  | TyChannel;

// ---------------------------------------------------------------------------
// Expressions
// ---------------------------------------------------------------------------

export type BinaryOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "=="
  | "!="
  | "<"
  | ">"
  | "<="
  | ">="
  | "&&"
  | "||";

export type UnaryOperator = "-" | "!" | "~";

export interface Const {
  kind: "Const";
  value: number | string | boolean | null;
  type: JvmType;
}

export interface LoadLocal {
  kind: "LoadLocal";
  name: string;
  type: JvmType;
}

export interface StoreLocal {
  kind: "StoreLocal";
  name: string;
  value: IRExpr;
  type: JvmType;
}

export interface BinaryOp {
  kind: "BinaryOp";
  op: BinaryOperator;
  left: IRExpr;
  right: IRExpr;
  type: JvmType;
}

export interface UnaryOp {
  kind: "UnaryOp";
  op: UnaryOperator;
  operand: IRExpr;
  type: JvmType;
}

export interface Call {
  kind: "Call";
  target: string;
  className: string;
  args: IRExpr[];
  returnType: JvmType;
  isStatic: boolean;
  /** Optional explicit JVM method descriptor, overrides auto-generated one. Used for Java interop. */
  explicitDescriptor?: string;
}

export interface NewObject {
  kind: "NewObject";
  className: string;
  args: IRExpr[];
}

export interface FieldGet {
  kind: "FieldGet";
  object: IRExpr;
  fieldName: string;
  type: JvmType;
}

export interface FieldSet {
  kind: "FieldSet";
  object: IRExpr;
  fieldName: string;
  value: IRExpr;
}

export interface ArrayNew {
  kind: "ArrayNew";
  elementType: JvmType;
  size: IRExpr;
}

export interface ArrayGet {
  kind: "ArrayGet";
  array: IRExpr;
  index: IRExpr;
  type: JvmType;
}

export interface ArraySet {
  kind: "ArraySet";
  array: IRExpr;
  index: IRExpr;
  value: IRExpr;
}

export interface Cast {
  kind: "Cast";
  expr: IRExpr;
  fromType: JvmType;
  toType: JvmType;
}

export interface Spawn {
  kind: "Spawn";
  call: Call;
}

export interface Await {
  kind: "Await";
  expr: IRExpr;
  type: JvmType;
}

export interface ChannelSend {
  kind: "ChannelSend";
  channel: IRExpr;
  value: IRExpr;
}

export interface ChannelRecv {
  kind: "ChannelRecv";
  channel: IRExpr;
  type: JvmType;
}

export interface Serve {
  kind: "Serve";
  port: IRExpr;
  handlerName: string;
}

export interface StringConcat {
  kind: "StringConcat";
  parts: IRExpr[];
}

export interface PropertyAccess {
  kind: "PropertyAccess";
  object: IRExpr;
  property: string;
  type: JvmType;
}

export interface StaticFieldGet {
  kind: "StaticFieldGet";
  className: string;
  fieldName: string;
  type: JvmType;
}

export type IRExpr =
  | Const
  | LoadLocal
  | StoreLocal
  | BinaryOp
  | UnaryOp
  | Call
  | NewObject
  | FieldGet
  | FieldSet
  | ArrayNew
  | ArrayGet
  | ArraySet
  | Cast
  | Spawn
  | Await
  | ChannelSend
  | ChannelRecv
  | Serve
  | StringConcat
  | PropertyAccess
  | StaticFieldGet;

// ---------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------

export interface ExprStmt {
  kind: "ExprStmt";
  expr: IRExpr;
}

export interface VarDecl {
  kind: "VarDecl";
  name: string;
  type: JvmType;
  init?: IRExpr;
}

export interface Return {
  kind: "Return";
  expr?: IRExpr;
}

export interface If {
  kind: "If";
  condition: IRExpr;
  thenBlock: Block;
  elseBlock?: Block;
}

export interface While {
  kind: "While";
  condition: IRExpr;
  body: Block;
}

export interface For {
  kind: "For";
  init?: IRStmt;
  condition?: IRExpr;
  update?: IRExpr;
  body: Block;
}

export interface Block {
  kind: "Block";
  stmts: IRStmt[];
}

export type IRStmt =
  | ExprStmt
  | VarDecl
  | Return
  | If
  | While
  | For
  | Block;

// ---------------------------------------------------------------------------
// Top-level Declarations
// ---------------------------------------------------------------------------

export interface Param {
  name: string;
  type: JvmType;
}

export interface Decorator {
  name: string;
  arguments: IRExpr[];
}

export interface Field {
  name: string;
  type: JvmType;
  decorators?: Decorator[];
}

export interface FunctionDef {
  kind: "FunctionDef";
  name: string;
  params: Param[];
  returnType: JvmType;
  body: Block;
  isExported: boolean;
  isTask: boolean;
  decorators?: Decorator[];
}

export interface ClassDef {
  kind: "ClassDef";
  name: string;
  fields: Field[];
  methods: FunctionDef[];
  isExported: boolean;
  decorators?: Decorator[];
}

export interface Import {
  className: string;
  alias?: string;
}

export interface Module {
  kind: "Module";
  name: string;
  classes: ClassDef[];
  functions: FunctionDef[];
  imports: Import[];
}

export type IRTopLevel = FunctionDef | ClassDef | Module;

// ---------------------------------------------------------------------------
// Helper: JVM type descriptor string
// ---------------------------------------------------------------------------

/**
 * Returns the JVM type descriptor for a given JvmType.
 *
 * Examples:
 *   TyInt    -> "I"
 *   TyDouble -> "D"
 *   TyString -> "Ljava/lang/String;"
 *   TyVoid   -> "V"
 *   TyArray({ elementType: TyInt }) -> "[I"
 */
export function jvmDescriptor(type: JvmType): string {
  switch (type.kind) {
    case "TyVoid":
      return "V";
    case "TyBoolean":
      return "Z";
    case "TyInt":
      return "I";
    case "TyLong":
      return "J";
    case "TyFloat":
      return "F";
    case "TyDouble":
      return "D";
    case "TyString":
      return "Ljava/lang/String;";
    case "TyArray":
      return "[" + jvmDescriptor(type.elementType);
    case "TyObject":
      return "L" + type.className.replace(/\./g, "/") + ";";
    case "TyTask":
      return "Ltyvm/runtime/Task;";
    case "TyChannel":
      return "Ltyvm/runtime/Channel;";
  }
}

// ---------------------------------------------------------------------------
// Helper: JVM internal name
// ---------------------------------------------------------------------------

/**
 * Returns the JVM internal name (slash-separated) for a type.
 * For primitives, returns the descriptor. For reference types, returns
 * the internal class name without the L...; wrapper.
 *
 * Examples:
 *   TyString -> "java/lang/String"
 *   TyObject("com.example.Foo") -> "com/example/Foo"
 *   TyInt -> "I"
 */
export function jvmInternalName(type: JvmType): string {
  switch (type.kind) {
    case "TyVoid":
      return "V";
    case "TyBoolean":
      return "Z";
    case "TyInt":
      return "I";
    case "TyLong":
      return "J";
    case "TyFloat":
      return "F";
    case "TyDouble":
      return "D";
    case "TyString":
      return "java/lang/String";
    case "TyArray":
      return "[" + jvmDescriptor(type.elementType);
    case "TyObject":
      return type.className.replace(/\./g, "/");
    case "TyTask":
      return "tyvm/runtime/Task";
    case "TyChannel":
      return "tyvm/runtime/Channel";
  }
}
