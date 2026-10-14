package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/tyvm/tyvm/pkg/emitter"
	"github.com/tyvm/tyvm/pkg/ir"
	"github.com/tyvm/tyvm/pkg/lexer"
	"github.com/tyvm/tyvm/pkg/parser"
)

const version = "0.2.0-go"

func main() {
	args := os.Args[1:]
	if len(args) == 0 {
		usage()
		return
	}

	cmd := args[0]
	switch cmd {
	case "version", "--version", "-v":
		fmt.Printf("tyvm %s\n", version)
		return
	case "help", "--help", "-h":
		usage()
		return
	}

	var inputFile string
	outDir := "./out"
	verbose := false
	run := false
	var classpath []string

	i := 0
	if cmd == "compile" || cmd == "run" {
		if cmd == "run" {
			run = true
		}
		i = 1
	}

	for i < len(args) {
		arg := args[i]
		i++
		switch arg {
		case "--out", "-o":
			if i < len(args) {
				outDir = args[i]
				i++
			}
		case "--run":
			run = true
		case "--verbose", "-V":
			verbose = true
		case "--cp", "--classpath":
			if i < len(args) {
				classpath = append(classpath, args[i])
				i++
			}
		case "compile", "run":
			// already handled
		default:
			if !strings.HasPrefix(arg, "-") {
				inputFile = arg
			}
		}
	}

	if inputFile == "" {
		fmt.Fprintln(os.Stderr, "error: no input file specified")
		os.Exit(1)
	}

	inputPath, _ := filepath.Abs(inputFile)
	outDir, _ = filepath.Abs(outDir)

	// 1. Read source
	t0 := time.Now()
	src, err := os.ReadFile(inputPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	// 2. Lex
	if verbose {
		fmt.Printf("lexing %s...\n", inputPath)
	}
	lex := lexer.New(src)
	tokens, err := lex.Tokenize()
	if err != nil {
		fmt.Fprintf(os.Stderr, "lex error: %v\n", err)
		os.Exit(1)
	}
	t1 := time.Now()
	if verbose {
		fmt.Printf("lexed %d tokens in %.1fms\n", len(tokens), float64(t1.Sub(t0).Microseconds())/1000)
	}

	// 3. Parse + lower to IR
	if verbose {
		fmt.Println("parsing + lowering to IR...")
	}
	baseName := strings.TrimSuffix(filepath.Base(inputFile), filepath.Ext(inputFile))
	// Convert to valid Java class name (replace hyphens)
	className := strings.ReplaceAll(baseName, "-", "_")
	// Capitalize first letter for Java convention
	if len(className) > 0 && className[0] >= 'a' && className[0] <= 'z' {
		className = strings.ToUpper(className[:1]) + className[1:]
	}

	p := parser.New(tokens)
	mod, err := p.Parse(className)
	if err != nil {
		fmt.Fprintf(os.Stderr, "parse error: %v\n", err)
		os.Exit(1)
	}
	t2 := time.Now()
	if verbose {
		fmt.Printf("parsed in %.1fms\n", float64(t2.Sub(t1).Microseconds())/1000)
		fmt.Printf("  functions: %d\n", len(mod.Functions))
	}

	// 4. Optimization passes
	if verbose {
		fmt.Println("optimizing IR...")
	}
	ir.IntPromote(mod)
	t3 := time.Now()
	if verbose {
		fmt.Printf("optimized in %.1fms\n", float64(t3.Sub(t2).Microseconds())/1000)
	}

	// 5. Emit bytecode
	if verbose {
		fmt.Println("emitting bytecode...")
	}
	results := emitter.Emit(mod)
	t4 := time.Now()
	if verbose {
		fmt.Printf("emitted in %.1fms\n", float64(t4.Sub(t3).Microseconds())/1000)
	}

	// 6. Write .class files
	os.MkdirAll(outDir, 0o755)
	for _, r := range results {
		path := filepath.Join(outDir, r.ClassName+".class")
		if err := os.WriteFile(path, r.Bytes, 0o644); err != nil {
			fmt.Fprintf(os.Stderr, "error writing %s: %v\n", path, err)
			os.Exit(1)
		}
		if verbose {
			fmt.Printf("  wrote %s (%d bytes)\n", path, len(r.Bytes))
		}
	}

	totalMs := float64(t4.Sub(t0).Microseconds()) / 1000
	mainClass := results[0].ClassName
	fmt.Printf("compiled %s -> %d class file(s) in %.1fms\n",
		filepath.Base(inputFile), len(results), totalMs)

	// 7. Run if requested
	if run {
		cpEntries := append([]string{outDir}, classpath...)
		// Look for runtime jar
		exePath, _ := os.Executable()
		runtimeJar := filepath.Join(filepath.Dir(exePath), "..", "runtime", "tyvm-runtime.jar")
		if _, err := os.Stat(runtimeJar); err == nil {
			cpEntries = append(cpEntries, runtimeJar)
		}
		// Also check cwd
		runtimeJar2 := filepath.Join("runtime", "tyvm-runtime.jar")
		if _, err := os.Stat(runtimeJar2); err == nil {
			cpEntries = append(cpEntries, runtimeJar2)
		}

		cp := strings.Join(cpEntries, ":")
		if verbose {
			fmt.Printf("running: java -cp \"%s\" %s\n", cp, mainClass)
		}

		cmd := exec.Command("java", "-cp", cp, mainClass)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Stdin = os.Stdin
		if err := cmd.Run(); err != nil {
			os.Exit(1)
		}
	}
}

func usage() {
	fmt.Printf(`tyvm %s (Go) — TypeScript to JVM compiler

Usage:
  tyvm compile <file.ts> [--out <dir>] [--run] [--verbose]
  tyvm run <file.ts> [--out <dir>] [--verbose]
  tyvm version
  tyvm help

Options:
  --out <dir>   Output directory for .class files (default: ./out)
  --run         Run the compiled program after compilation
  --verbose     Print detailed compilation info
  --cp <path>   Additional classpath entries (separated by :)
`, version)
}
