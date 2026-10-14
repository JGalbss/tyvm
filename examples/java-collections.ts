// Demonstrate using Java collection classes from TypeScript.
//
// This example creates a java.util.ArrayList, adds elements,
// and queries its size -- all compiled to JVM bytecode.

import { ArrayList } from "java:java.util.ArrayList";

function main(): void {
  // Create a new ArrayList instance
  const list: ArrayList = new ArrayList();

  // Add elements using the instance method add()
  list.add("hello");
  list.add("world");
  list.add("from");
  list.add("tyvm");

  // Get the size
  const size: number = list.size();
  console.log(size);

  // Retrieve elements by index
  const first: string = list.get(0);
  console.log(first);

  const second: string = list.get(1);
  console.log(second);

  // Check if it contains an element
  const hasWorld: boolean = list.contains("world");
  console.log(hasWorld);

  // Convert to string representation
  const str: string = list.toString();
  console.log(str);
}
