package classfile

const (
	OpNOP         = 0x00
	OpACONST_NULL = 0x01

	// Integer constants
	OpICONST_M1 = 0x02
	OpICONST_0  = 0x03
	OpICONST_1  = 0x04
	OpICONST_2  = 0x05
	OpICONST_3  = 0x06
	OpICONST_4  = 0x07
	OpICONST_5  = 0x08

	// Long constants
	OpLCONST_0 = 0x09
	OpLCONST_1 = 0x0a

	// Double constants
	OpDCONST_0 = 0x0e
	OpDCONST_1 = 0x0f

	// Push
	OpBIPUSH = 0x10
	OpSIPUSH = 0x11
	OpLDC    = 0x12
	OpLDC_W  = 0x13
	OpLDC2_W = 0x14

	// Loads
	OpILOAD   = 0x15
	OpLLOAD   = 0x16
	OpDLOAD   = 0x18
	OpALOAD   = 0x19
	OpILOAD_0 = 0x1a
	OpILOAD_1 = 0x1b
	OpILOAD_2 = 0x1c
	OpILOAD_3 = 0x1d
	OpLLOAD_0 = 0x1e
	OpLLOAD_1 = 0x1f
	OpLLOAD_2 = 0x20
	OpLLOAD_3 = 0x21
	OpDLOAD_0 = 0x26
	OpDLOAD_1 = 0x27
	OpDLOAD_2 = 0x28
	OpDLOAD_3 = 0x29
	OpALOAD_0 = 0x2a
	OpALOAD_1 = 0x2b
	OpALOAD_2 = 0x2c
	OpALOAD_3 = 0x2d

	// Stores
	OpISTORE   = 0x36
	OpLSTORE   = 0x37
	OpDSTORE   = 0x39
	OpASTORE   = 0x3a
	OpISTORE_0 = 0x3b
	OpISTORE_1 = 0x3c
	OpISTORE_2 = 0x3d
	OpISTORE_3 = 0x3e
	OpLSTORE_0 = 0x3f
	OpLSTORE_1 = 0x40
	OpLSTORE_2 = 0x41
	OpLSTORE_3 = 0x42
	OpDSTORE_0 = 0x47
	OpDSTORE_1 = 0x48
	OpDSTORE_2 = 0x49
	OpDSTORE_3 = 0x4a
	OpASTORE_0 = 0x4b
	OpASTORE_1 = 0x4c
	OpASTORE_2 = 0x4d
	OpASTORE_3 = 0x4e

	// Stack
	OpPOP  = 0x57
	OpPOP2 = 0x58
	OpDUP  = 0x59

	// Arithmetic
	OpIADD = 0x60
	OpLADD = 0x61
	OpDADD = 0x63
	OpISUB = 0x64
	OpLSUB = 0x65
	OpDSUB = 0x67
	OpIMUL = 0x68
	OpLMUL = 0x69
	OpDMUL = 0x6b
	OpIDIV = 0x6c
	OpLDIV = 0x6d
	OpDDIV = 0x6f
	OpIREM = 0x70
	OpLREM = 0x71
	OpDREM = 0x73

	// Negation
	OpINEG = 0x74
	OpLNEG = 0x75
	OpDNEG = 0x77

	// Conversions
	OpI2L = 0x85
	OpI2D = 0x87
	OpL2I = 0x88
	OpL2D = 0x8a
	OpD2I = 0x8e
	OpD2L = 0x8f

	// Comparisons
	OpLCMP  = 0x94
	OpDCMPL = 0x97
	OpDCMPG = 0x98

	// Branches
	OpIFEQ = 0x99
	OpIFNE = 0x9a
	OpIFLT = 0x9b
	OpIFGE = 0x9c
	OpIFGT = 0x9d
	OpIFLE = 0x9e

	OpIF_ICMPEQ = 0x9f
	OpIF_ICMPNE = 0xa0
	OpIF_ICMPLT = 0xa1
	OpIF_ICMPGE = 0xa2
	OpIF_ICMPGT = 0xa3
	OpIF_ICMPLE = 0xa4

	OpGOTO = 0xa7

	// Returns
	OpIRETURN = 0xac
	OpLRETURN = 0xad
	OpDRETURN = 0xaf
	OpARETURN = 0xb0
	OpRETURN  = 0xb1

	// Field/method access
	OpGETSTATIC       = 0xb2
	OpPUTSTATIC       = 0xb3
	OpGETFIELD        = 0xb4
	OpPUTFIELD        = 0xb5
	OpINVOKEVIRTUAL   = 0xb6
	OpINVOKESPECIAL   = 0xb7
	OpINVOKESTATIC    = 0xb8
	OpINVOKEINTERFACE = 0xb9

	// Object creation
	OpNEW      = 0xbb
	OpNEWARRAY = 0xbc
)
