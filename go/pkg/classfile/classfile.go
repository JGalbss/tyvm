// Package classfile produces valid JVM .class file bytes.
// Targets class file version 49 (Java 5) to avoid StackMapTable.
package classfile

import (
	"encoding/binary"
	"math"
)

const (
	ClassMagic        = 0xCAFEBABE
	ClassMajorVersion = 49
	ClassMinorVersion = 0
)

// Constant pool tags
const (
	ConstUtf8               = 1
	ConstInteger            = 3
	ConstFloat              = 4
	ConstLong               = 5
	ConstDouble             = 6
	ConstClass              = 7
	ConstString             = 8
	ConstFieldref           = 9
	ConstMethodref          = 10
	ConstInterfaceMethodref = 11
	ConstNameAndType        = 12
)

// Access flags
const (
	AccPublic  = 0x0001
	AccStatic  = 0x0008
	AccFinal   = 0x0010
	AccSuper   = 0x0020
)

// cpEntry is a constant pool entry.
type cpEntry struct {
	tag  byte
	data []byte
}

// MethodBuilder emits bytecode for a single method.
type MethodBuilder struct {
	Code      []byte
	MaxStack  int
	MaxLocals int
	labels    map[int]int    // label id -> offset (-1 if unresolved)
	fwdRefs   map[int][]fwdRef
	nextLabel int
}

type fwdRef struct {
	patchOffset int
	instrOffset int
}

func NewMethodBuilder() *MethodBuilder {
	return &MethodBuilder{
		labels:  make(map[int]int),
		fwdRefs: make(map[int][]fwdRef),
	}
}

func (m *MethodBuilder) Emit(opcode byte) {
	m.Code = append(m.Code, opcode)
}

func (m *MethodBuilder) EmitByte(b byte) {
	m.Code = append(m.Code, b)
}

func (m *MethodBuilder) EmitShort(v int) {
	m.Code = append(m.Code, byte(v>>8), byte(v))
}

func (m *MethodBuilder) EmitInt(v int) {
	m.Code = append(m.Code, byte(v>>24), byte(v>>16), byte(v>>8), byte(v))
}

func (m *MethodBuilder) Label() int {
	id := m.nextLabel
	m.nextLabel++
	m.labels[id] = -1
	return id
}

func (m *MethodBuilder) PlaceLabel(id int) {
	offset := len(m.Code)
	m.labels[id] = offset
	if refs, ok := m.fwdRefs[id]; ok {
		for _, ref := range refs {
			rel := offset - ref.instrOffset
			m.Code[ref.patchOffset] = byte(rel >> 8)
			m.Code[ref.patchOffset+1] = byte(rel)
		}
		delete(m.fwdRefs, id)
	}
}

func (m *MethodBuilder) EmitJump(opcode byte, labelID int) {
	instrOffset := len(m.Code)
	m.Emit(opcode)
	if resolved, ok := m.labels[labelID]; ok && resolved >= 0 {
		rel := resolved - instrOffset
		m.EmitShort(rel)
	} else {
		patchOffset := len(m.Code)
		m.EmitShort(0)
		m.fwdRefs[labelID] = append(m.fwdRefs[labelID], fwdRef{patchOffset, instrOffset})
	}
}

func (m *MethodBuilder) Offset() int {
	return len(m.Code)
}

func (m *MethodBuilder) EmitLdc(cpIndex int) {
	if cpIndex <= 255 {
		m.Emit(OpLDC)
		m.EmitByte(byte(cpIndex))
	} else {
		m.Emit(OpLDC_W)
		m.EmitShort(cpIndex)
	}
}

// ClassWriter builds a JVM class file.
type ClassWriter struct {
	pool      []cpEntry
	poolDedup map[string]int

	accessFlags    int
	thisClassIdx   int
	superClassIdx  int
	fields         []fieldInfo
	methods        []methodInfo
}

type fieldInfo struct {
	accessFlags int
	nameIdx     int
	descIdx     int
}

type methodInfo struct {
	accessFlags int
	nameIdx     int
	descIdx     int
	builder     *MethodBuilder
}

func NewClassWriter() *ClassWriter {
	return &ClassWriter{
		pool:      []cpEntry{{}}, // slot 0 unused
		poolDedup: make(map[string]int),
	}
}

func (w *ClassWriter) nextIdx() int { return len(w.pool) }

func (w *ClassWriter) AddUtf8(s string) int {
	key := "utf8:" + s
	if idx, ok := w.poolDedup[key]; ok {
		return idx
	}
	idx := w.nextIdx()
	data := []byte(s)
	buf := make([]byte, 2+len(data))
	binary.BigEndian.PutUint16(buf, uint16(len(data)))
	copy(buf[2:], data)
	w.pool = append(w.pool, cpEntry{ConstUtf8, buf})
	w.poolDedup[key] = idx
	return idx
}

func (w *ClassWriter) AddInteger(v int32) int {
	key := "int:" + string(rune(v))
	if idx, ok := w.poolDedup[key]; ok {
		return idx
	}
	idx := w.nextIdx()
	buf := make([]byte, 4)
	binary.BigEndian.PutUint32(buf, uint32(v))
	w.pool = append(w.pool, cpEntry{ConstInteger, buf})
	w.poolDedup[key] = idx
	return idx
}

func (w *ClassWriter) AddLong(v int64) int {
	idx := w.nextIdx()
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, uint64(v))
	w.pool = append(w.pool, cpEntry{ConstLong, buf})
	w.pool = append(w.pool, cpEntry{}) // placeholder
	return idx
}

func (w *ClassWriter) AddDouble(v float64) int {
	idx := w.nextIdx()
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, math.Float64bits(v))
	w.pool = append(w.pool, cpEntry{ConstDouble, buf})
	w.pool = append(w.pool, cpEntry{}) // placeholder
	return idx
}

func (w *ClassWriter) AddClass(name string) int {
	key := "class:" + name
	if idx, ok := w.poolDedup[key]; ok {
		return idx
	}
	nameIdx := w.AddUtf8(name)
	idx := w.nextIdx()
	buf := make([]byte, 2)
	binary.BigEndian.PutUint16(buf, uint16(nameIdx))
	w.pool = append(w.pool, cpEntry{ConstClass, buf})
	w.poolDedup[key] = idx
	return idx
}

func (w *ClassWriter) AddString(s string) int {
	key := "string:" + s
	if idx, ok := w.poolDedup[key]; ok {
		return idx
	}
	strIdx := w.AddUtf8(s)
	idx := w.nextIdx()
	buf := make([]byte, 2)
	binary.BigEndian.PutUint16(buf, uint16(strIdx))
	w.pool = append(w.pool, cpEntry{ConstString, buf})
	w.poolDedup[key] = idx
	return idx
}

func (w *ClassWriter) AddNameAndType(name, desc string) int {
	key := "nat:" + name + ":" + desc
	if idx, ok := w.poolDedup[key]; ok {
		return idx
	}
	nameIdx := w.AddUtf8(name)
	descIdx := w.AddUtf8(desc)
	idx := w.nextIdx()
	buf := make([]byte, 4)
	binary.BigEndian.PutUint16(buf, uint16(nameIdx))
	binary.BigEndian.PutUint16(buf[2:], uint16(descIdx))
	w.pool = append(w.pool, cpEntry{ConstNameAndType, buf})
	w.poolDedup[key] = idx
	return idx
}

func (w *ClassWriter) AddMethodref(className, methodName, desc string) int {
	key := "mref:" + className + ":" + methodName + ":" + desc
	if idx, ok := w.poolDedup[key]; ok {
		return idx
	}
	classIdx := w.AddClass(className)
	natIdx := w.AddNameAndType(methodName, desc)
	idx := w.nextIdx()
	buf := make([]byte, 4)
	binary.BigEndian.PutUint16(buf, uint16(classIdx))
	binary.BigEndian.PutUint16(buf[2:], uint16(natIdx))
	w.pool = append(w.pool, cpEntry{ConstMethodref, buf})
	w.poolDedup[key] = idx
	return idx
}

func (w *ClassWriter) AddFieldref(className, fieldName, desc string) int {
	key := "fref:" + className + ":" + fieldName + ":" + desc
	if idx, ok := w.poolDedup[key]; ok {
		return idx
	}
	classIdx := w.AddClass(className)
	natIdx := w.AddNameAndType(fieldName, desc)
	idx := w.nextIdx()
	buf := make([]byte, 4)
	binary.BigEndian.PutUint16(buf, uint16(classIdx))
	binary.BigEndian.PutUint16(buf[2:], uint16(natIdx))
	w.pool = append(w.pool, cpEntry{ConstFieldref, buf})
	w.poolDedup[key] = idx
	return idx
}

func (w *ClassWriter) SetClass(flags int, thisClass, superClass string) {
	w.accessFlags = flags
	w.thisClassIdx = w.AddClass(thisClass)
	w.superClassIdx = w.AddClass(superClass)
}

func (w *ClassWriter) AddField(flags int, name, desc string) {
	w.fields = append(w.fields, fieldInfo{
		accessFlags: flags,
		nameIdx:     w.AddUtf8(name),
		descIdx:     w.AddUtf8(desc),
	})
}

func (w *ClassWriter) AddMethod(flags int, name, desc string) *MethodBuilder {
	nameIdx := w.AddUtf8(name)
	descIdx := w.AddUtf8(desc)
	w.AddUtf8("Code")
	mb := NewMethodBuilder()
	w.methods = append(w.methods, methodInfo{
		accessFlags: flags,
		nameIdx:     nameIdx,
		descIdx:     descIdx,
		builder:     mb,
	})
	return mb
}

func (w *ClassWriter) ToBytes() []byte {
	var buf []byte

	// Magic
	buf = appendU4(buf, ClassMagic)
	// Version
	buf = appendU2(buf, ClassMinorVersion)
	buf = appendU2(buf, ClassMajorVersion)

	// Constant pool
	buf = appendU2(buf, len(w.pool))
	for i := 1; i < len(w.pool); i++ {
		e := w.pool[i]
		if e.tag == 0 {
			continue // placeholder for long/double
		}
		buf = append(buf, e.tag)
		buf = append(buf, e.data...)
	}

	// Access, this, super
	buf = appendU2(buf, w.accessFlags)
	buf = appendU2(buf, w.thisClassIdx)
	buf = appendU2(buf, w.superClassIdx)

	// Interfaces
	buf = appendU2(buf, 0)

	// Fields
	buf = appendU2(buf, len(w.fields))
	for _, f := range w.fields {
		buf = appendU2(buf, f.accessFlags)
		buf = appendU2(buf, f.nameIdx)
		buf = appendU2(buf, f.descIdx)
		buf = appendU2(buf, 0) // attributes count
	}

	// Methods
	buf = appendU2(buf, len(w.methods))
	for _, m := range w.methods {
		buf = appendU2(buf, m.accessFlags)
		buf = appendU2(buf, m.nameIdx)
		buf = appendU2(buf, m.descIdx)

		// 1 attribute: Code
		code := m.builder.Code
		maxStack := m.builder.MaxStack
		if maxStack == 0 {
			maxStack = 64
		}
		maxLocals := m.builder.MaxLocals
		if maxLocals == 0 {
			maxLocals = 64
		}

		codeAttrNameIdx := w.AddUtf8("Code")
		codeAttrLen := 2 + 2 + 4 + len(code) + 2 + 2 // max_stack + max_locals + code_len + code + exception_table_len + attributes_count

		buf = appendU2(buf, 1) // attributes count
		buf = appendU2(buf, codeAttrNameIdx)
		buf = appendU4(buf, codeAttrLen)
		buf = appendU2(buf, maxStack)
		buf = appendU2(buf, maxLocals)
		buf = appendU4(buf, len(code))
		buf = append(buf, code...)
		buf = appendU2(buf, 0) // exception table
		buf = appendU2(buf, 0) // code attributes
	}

	// Class attributes
	buf = appendU2(buf, 0)

	return buf
}

func appendU2(buf []byte, v int) []byte {
	return append(buf, byte(v>>8), byte(v))
}

func appendU4(buf []byte, v int) []byte {
	return append(buf, byte(v>>24), byte(v>>16), byte(v>>8), byte(v))
}
