
import re

def check_balance(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()

    stack = []
    
    # Simple parser to ignore comments and strings could be complex, 
    # but for a quick check we can try to track basic nesting.
    # We'll try to visually identify the line number where it goes wrong.
    
    for i, line in enumerate(lines):
        line_num = i + 1
        # Remove simple strings "..." and '...'
        # This is a naive regex removal, might fail on complex cases but good for approximate check
        line_clean = re.sub(r'"[^"]*"', '""', line) 
        line_clean = re.sub(r"'[^']*'", "''", line_clean)
        # Remove comments
        line_clean = re.sub(r'//.*', '', line_clean)
        
        for char in line_clean:
            if char in '{[(':
                stack.append((char, line_num))
            elif char in '}])':
                if not stack:
                    print(f"Error: Unexpected closing '{char}' at line {line_num}")
                    return
                last, last_line = stack.pop()
                expected = '{' if char == '}' else '[' if char == ']' else '('
                if last != expected:
                    print(f"Error: Mismatched '{char}' at line {line_num}. Expected match for '{last}' from line {last_line}")
                    return

    if stack:
        print("Error: Unclosed groups:")
        for char, line in stack:
            print(f"  '{char}' opened at line {line}")
    else:
        print("Success: All braces balanced.")

check_balance('/Users/apple/Documents/Centro-de-Mando---Pron-sticos-1/components/ai/AnalysisReportModal.tsx')
