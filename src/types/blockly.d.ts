declare namespace Blockly {
  interface Block {
    getFieldValue(name: string): string;
  }
  
  interface JavascriptGenerator {
    [key: string]: (block: Block) => string;
    statementToCode(block: Block, name: string): string;
    valueToCode(block: Block, name: string, order: number): string;
  }
}

declare const javascriptGenerator: Blockly.JavascriptGenerator;

declare const ORDER_LOGICAL_OR = 1;
declare const ORDER_LOGICAL_AND = 2;
declare const ORDER_EQUALITY = 3;
declare const ORDER_RELATIONAL = 4;
declare const ORDER_ADDITION = 5;
declare const ORDER_MULTIPLICATION = 6;
declare const ORDER_NONE = 99;

declare function valueToCodeNumber(block: Blockly.Block, field: string, defaultValue: number): number;