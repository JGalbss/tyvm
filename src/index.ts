export { parseFile, parseSource } from "./frontend/parse.js";
export type { ParseResult } from "./frontend/parse.js";

export { Lowerer, lower } from "./frontend/lower.js";

export { emit } from "./backend/emitter.js";
export type { EmitResult } from "./backend/emitter.js";

export { ClassFileWriter, MethodBuilder } from "./backend/classfile.js";
export { ACC_PUBLIC, ACC_STATIC, ACC_FINAL, ACC_SUPER } from "./backend/classfile.js";

export { Opcode } from "./backend/opcodes.js";

export { typeToDescriptor, methodDescriptor, typeToInternalName, typeSlotSize } from "./backend/descriptors.js";

export type {
  JvmType,
  IRExpr,
  IRStmt,
  IRTopLevel,
  Module as IRModule,
  FunctionDef,
  ClassDef,
  Block,
  Param,
  Field,
} from "./ir/nodes.js";
export { jvmDescriptor, jvmInternalName } from "./ir/nodes.js";

export {
  compileFromEntry,
  compileDirectory,
  compileProject,
  discoverDependencies,
  topologicalSort,
} from "./frontend/project.js";
export type {
  CompiledModule,
  ModuleExports,
  ExportedFunction,
} from "./frontend/project.js";

export {
  resolveModuleSpecifier,
  collectTsFiles,
  fileToClassName,
} from "./frontend/resolver.js";
export type { ResolvedModule } from "./frontend/resolver.js";
