import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@examportal.com' },
    update: {},
    create: {
      email: 'admin@examportal.com',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      name: 'System Admin',
      admin: {
        create: {
          name: 'System Admin',
        },
      },
    },
  });
  console.log(`✅ Admin user created: ${adminUser.email}`);

  // Create sample students
  const students = [
    { name: 'Alice Johnson', regNo: 'STU001', className: 'CS-A', email: 'alice@student.com', password: 'student123' },
    { name: 'Bob Smith', regNo: 'STU002', className: 'CS-A', email: 'bob@student.com', password: 'student123' },
    { name: 'Charlie Brown', regNo: 'STU003', className: 'CS-B', email: 'charlie@student.com', password: 'student123' },
  ];

  for (const s of students) {
    const hash = await bcrypt.hash(s.password, 12);
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        passwordHash: hash,
        role: Role.STUDENT,
        name: s.name,
        student: {
          create: {
            name: s.name,
            regNo: s.regNo,
            className: s.className,
            email: s.email,
          },
        },
      },
    });
    console.log(`✅ Student created: ${s.name} (${s.regNo})`);
  }

  // Create sample questions
  const q1 = await prisma.question.upsert({
    where: { id: 'q1-two-sum' },
    update: {},
    create: {
      id: 'q1-two-sum',
      title: 'Two Sum',
      description:
        'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.',
      constraints: '2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nOnly one valid answer exists.',
      inputFormat: 'First line: space-separated integers (the array)\nSecond line: an integer (the target)',
      outputFormat: 'Two space-separated integers (the indices, 0-based)',
      sampleInput: '2 7 11 15\n9',
      sampleOutput: '0 1',
      maxMarks: 100,
      allowedLanguages: ['python', 'java', 'c', 'cpp'],
      starterCodePython:
        'def two_sum(nums, target):\n    # Write your solution here\n    pass\n\n# Read input\nnums = list(map(int, input().split()))\ntarget = int(input())\nresult = two_sum(nums, target)\nprint(result[0], result[1])',
      starterCodeJava:
        'import java.util.*;\n\npublic class Main {\n    public static int[] twoSum(int[] nums, int target) {\n        // Write your solution here\n        return new int[]{};\n    }\n\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String[] parts = sc.nextLine().split(" ");\n        int[] nums = new int[parts.length];\n        for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);\n        int target = Integer.parseInt(sc.nextLine());\n        int[] result = twoSum(nums, target);\n        System.out.println(result[0] + " " + result[1]);\n    }\n}',
      starterCodeC:
        '#include <stdio.h>\n#include <stdlib.h>\n\nint main() {\n    // Read input and solve Two Sum\n    // Write your solution here\n    return 0;\n}',
      starterCodeCpp:
        '#include <iostream>\n#include <vector>\n#include <unordered_map>\nusing namespace std;\n\nint main() {\n    // Read input and solve Two Sum\n    // Write your solution here\n    return 0;\n}',
      timeLimitMs: 2000,
      memoryLimitKb: 262144,
      testCases: {
        create: [
          { input: '2 7 11 15\n9', expectedOutput: '0 1', isSample: true, order: 1, weight: 1.0 },
          { input: '3 2 4\n6', expectedOutput: '1 2', isSample: true, order: 2, weight: 1.0 },
          { input: '3 3\n6', expectedOutput: '0 1', isSample: false, order: 3, weight: 1.0 },
          { input: '11 5 13 4 20\n9', expectedOutput: '1 3', isSample: false, order: 4, weight: 1.0 },
          { input: '-1 -2 -3 -4 -5\n-8', expectedOutput: '2 4', isSample: false, order: 5, weight: 1.0 },
        ],
      },
    },
  });
  console.log(`✅ Question created: ${q1.title}`);

  const q2 = await prisma.question.upsert({
    where: { id: 'q2-reverse-string' },
    update: {},
    create: {
      id: 'q2-reverse-string',
      title: 'Reverse String',
      description:
        'Write a function that reverses a string. The input string is given as an array of characters.\n\nYou must do this by modifying the input array in-place with O(1) extra memory.',
      constraints: '1 <= s.length <= 10^5\ns[i] is a printable ascii character.',
      inputFormat: 'A single line containing a string',
      outputFormat: 'The reversed string',
      sampleInput: 'hello',
      sampleOutput: 'olleh',
      maxMarks: 50,
      allowedLanguages: ['python', 'java', 'c', 'cpp'],
      starterCodePython: 's = input()\n# Write your solution here to reverse string\n',
      starterCodeJava:
        'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String s = sc.nextLine();\n        // Reverse and print\n    }\n}',
      starterCodeC:
        '#include <stdio.h>\n#include <string.h>\n\nint main() {\n    char s[100001];\n    scanf("%s", s);\n    // Reverse and print\n    return 0;\n}',
      starterCodeCpp:
        '#include <iostream>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n    string s;\n    cin >> s;\n    // Reverse and print\n    return 0;\n}',
      timeLimitMs: 1000,
      memoryLimitKb: 262144,
      testCases: {
        create: [
          { input: 'hello', expectedOutput: 'olleh', isSample: true, order: 1, weight: 1.0 },
          { input: 'Hannah', expectedOutput: 'hannaH', isSample: true, order: 2, weight: 1.0 },
          { input: 'abcdefghij', expectedOutput: 'jihgfedcba', isSample: false, order: 3, weight: 1.0 },
          { input: 'a', expectedOutput: 'a', isSample: false, order: 4, weight: 1.0 },
        ],
      },
    },
  });
  console.log(`✅ Question created: ${q2.title}`);

  const q3 = await prisma.question.upsert({
    where: { id: 'q3-fibonacci' },
    update: {},
    create: {
      id: 'q3-fibonacci',
      title: 'Fibonacci Number',
      description:
        'The Fibonacci numbers, commonly denoted F(n) form a sequence, called the Fibonacci sequence, such that each number is the sum of the two preceding ones, starting from 0 and 1.\n\nF(0) = 0, F(1) = 1\nF(n) = F(n - 1) + F(n - 2), for n > 1.\n\nGiven n, calculate F(n).',
      constraints: '0 <= n <= 30',
      inputFormat: 'A single integer n',
      outputFormat: 'F(n)',
      sampleInput: '4',
      sampleOutput: '3',
      maxMarks: 75,
      allowedLanguages: ['python', 'java', 'c', 'cpp'],
      starterCodePython: 'n = int(input())\n# Calculate F(n)\n',
      starterCodeJava:
        'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        // Calculate F(n)\n    }\n}',
      starterCodeC:
        '#include <stdio.h>\n\nint main() {\n    int n;\n    scanf("%d", &n);\n    // Calculate F(n)\n    return 0;\n}',
      starterCodeCpp:
        '#include <iostream>\nusing namespace std;\n\nint main() {\n    int n;\n    cin >> n;\n    // Calculate F(n)\n    return 0;\n}',
      timeLimitMs: 1000,
      memoryLimitKb: 262144,
      testCases: {
        create: [
          { input: '2', expectedOutput: '1', isSample: true, order: 1, weight: 1.0 },
          { input: '4', expectedOutput: '3', isSample: true, order: 2, weight: 1.0 },
          { input: '0', expectedOutput: '0', isSample: false, order: 3, weight: 1.0 },
          { input: '1', expectedOutput: '1', isSample: false, order: 4, weight: 1.0 },
          { input: '10', expectedOutput: '55', isSample: false, order: 5, weight: 1.0 },
          { input: '20', expectedOutput: '6765', isSample: false, order: 6, weight: 1.0 },
          { input: '30', expectedOutput: '832040', isSample: false, order: 7, weight: 1.0 },
        ],
      },
    },
  });
  console.log(`✅ Question created: ${q3.title}`);

  const q4 = await prisma.question.upsert({
    where: { id: 'q4-trapping-rain-water' },
    update: {},
    create: {
      id: 'q4-trapping-rain-water',
      title: 'Trapping Rain Water',
      description:
        'Given n non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.\n\nReturn the total amount of water trapped.',
      constraints: 'n == height.length\n1 <= n <= 2 * 10^4\n0 <= height[i] <= 10^5',
      inputFormat: 'A single line containing space-separated non-negative integers representing the elevation map height.',
      outputFormat: 'A single integer representing the total units of rain water trapped.',
      sampleInput: '0 1 0 2 1 0 1 3 2 1 2 1',
      sampleOutput: '6',
      maxMarks: 150,
      allowedLanguages: ['python', 'java', 'c', 'cpp'],
      starterCodePython:
        'def trap(height):\n    # Write your solution here\n    pass\n\nline = input().strip()\nif not line:\n    print(0)\nelse:\n    height = list(map(int, line.split()))\n    print(trap(height))\n',
      starterCodeJava:
        'import java.util.*;\n\npublic class Main {\n    public static int trap(int[] height) {\n        // Write your solution here\n        return 0;\n    }\n\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNextLine()) { System.out.println(0); return; }\n        String line = sc.nextLine().trim();\n        if (line.isEmpty()) { System.out.println(0); return; }\n        String[] parts = line.split("\\\\s+");\n        int[] height = new int[parts.length];\n        for (int i = 0; i < parts.length; i++) height[i] = Integer.parseInt(parts[i]);\n        System.out.println(trap(height));\n    }\n}',
      starterCodeC:
        '#include <stdio.h>\n#include <stdlib.h>\n\nint trap(int* height, int heightSize) {\n    // Write your solution here\n    return 0;\n}\n\nint main() {\n    int height[20005];\n    int n = 0;\n    while (scanf("%d", &height[n]) == 1) n++;\n    printf("%d\\n", trap(height, n));\n    return 0;\n}',
      starterCodeCpp:
        '#include <iostream>\n#include <vector>\nusing namespace std;\n\nint trap(vector<int>& height) {\n    // Write your solution here\n    return 0;\n}\n\nint main() {\n    vector<int> height;\n    int val;\n    while (cin >> val) height.push_back(val);\n    cout << trap(height) << endl;\n    return 0;\n}',
      timeLimitMs: 2000,
      memoryLimitKb: 262144,
      testCases: {
        create: [
          { input: '0 1 0 2 1 0 1 3 2 1 2 1', expectedOutput: '6', isSample: true, order: 1, weight: 1.0 },
          { input: '4 2 0 3 2 5', expectedOutput: '9', isSample: true, order: 2, weight: 1.0 },
          { input: '1 2 3 4 5', expectedOutput: '0', isSample: false, order: 3, weight: 1.0 },
          { input: '5 4 3 2 1', expectedOutput: '0', isSample: false, order: 4, weight: 1.0 },
          { input: '3 0 2 0 4', expectedOutput: '7', isSample: false, order: 5, weight: 1.0 },
          { input: '2 0 2', expectedOutput: '2', isSample: false, order: 6, weight: 1.0 },
          { input: '5 1 1 1 5', expectedOutput: '12', isSample: false, order: 7, weight: 1.0 },
        ],
      },
    },
  });
  console.log(`✅ Question created: ${q4.title}`);

  console.log('🌱 Seeding complete!');
  console.log('\n📋 Default credentials:');
  console.log('  Admin: admin@examportal.com / admin123');
  console.log('  Students: alice@student.com / student123 (STU001)');
  console.log('            bob@student.com / student123 (STU002)');
  console.log('            charlie@student.com / student123 (STU003)');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
