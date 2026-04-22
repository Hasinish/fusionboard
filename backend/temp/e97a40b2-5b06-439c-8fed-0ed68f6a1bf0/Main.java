import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        
        System.out.println("=== FusionBoard Interactive Test ===");
        System.out.print("Enter your name: ");
        
        // The program will PAUSE here and wait for you 
        // to type in the terminal at the bottom!
        String name = scanner.nextLine();
        
        System.out.println("Hello, " + name + "!");
        System.out.println("Try resizing the terminal while I'm waiting for input...");
        
        System.out.print("Pick a number: ");
        int num = scanner.nextInt();
        
        System.out.println("The square of " + num + " is " + (num * num));
        System.out.println("Test Complete!");
    }
}
