export const LANGUAGES = [
    { id: "javascript", name: "JavaScript", color: "#facc15" },
    { id: "python", name: "Python", color: "#3b82f6" },
    { id: "java", name: "Java", color: "#ef4444" },
    { id: "cpp", name: "C++", color: "#00599C" },
    { id: "go", name: "Go", color: "#00ADD8" },
    { id: "rust", name: "Rust", color: "#DEA584" },
];

export const BOILERPLATES = {
    javascript: "console.log('Hello from JS!');",
    python: "print('Hello from Python!')",
    java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java!");
    }
}`,
    cpp: `#include <iostream>

int main() {
    std::cout << "Hello from C++!" << std::endl;
    return 0;
}`,
    go: `package main

import "fmt"

func main() {
    fmt.Println("Hello from Go!")
}`,
    rust: `fn main() {
    println!("Hello from Rust!");
}`
};

export const LANGUAGE_IDS = {
    java: 62,   // OpenJDK 13+
    cpp: 54,    // GCC 9.2.0
    go: 60,     // 1.13.5
    rust: 73    // 1.40.0
};
