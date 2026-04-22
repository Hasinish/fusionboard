import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        System.out.println("=== FusionBoard Java Test ===");
        
        // Test ArrayList and Loops
        List<String> features = new ArrayList<>();
        features.add("Real-time Yjs Sync");
        features.add("Infinite Canvas");
        features.add("Multi-user Cursors");
        
        System.out.println("Testing iteration over collections:");
        for (int i = 0; i < features.size(); i++) {
            System.out.println("  [" + (i + 1) + "] " + features.get(i));
        }
        
        // Test Math logic
        int n = 10;
        long result = fibonacci(n);
        System.out.println("\nMathematics Test:");
        System.out.println("  Fibonacci sequence at index " + n + " is: " + result);
        
        System.out.println("\n--- All tests completed successfully ---");
    }

    public static long fibonacci(int n) {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
    }
}
