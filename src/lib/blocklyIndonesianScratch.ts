// Indonesian Scratch-style Blockly extensions
// Auto-generated: Custom block definitions, generators, toolbox XML, and theme
// This file can be imported in the Blockly editor page before injecting the workspace.

// Use full Blockly bundle for proper typings of generators (JavaScript) instead of core-only.
import * as Blockly from "blockly";
import "blockly/blocks";
import { javascriptGenerator as jsGen } from "blockly/javascript";
// Cast to any to attach custom block generators without fighting TS private typings.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const javascriptGenerator: any = jsGen;
// Local order fallbacks (Blockly's generated code uses these numeric precedences). Values mirror upstream defaults.
const ORDER_NONE = 99;
const ORDER_LOGICAL_OR = 4;
const ORDER_ADDITION = 12;
const ORDER_EQUALITY = 6;

/****************************** THEME ***********************************/
export const ScratchTheme = Blockly.Theme.defineTheme("scratchTheme", {
  name: "scratchTheme",
  base: Blockly.Themes.Classic,
  blockStyles: {
    logic_blocks: { colourPrimary: "#FFBF00" },
    loop_blocks: { colourPrimary: "#FFAB19" },
    math_blocks: { colourPrimary: "#59C059" },
    text_blocks: { colourPrimary: "#9966FF" },
    list_blocks: { colourPrimary: "#FF6680" },
    variable_blocks: { colourPrimary: "#FF8C1A" },
    procedure_blocks: { colourPrimary: "#FF6680" },
    motion_blocks: { colourPrimary: "#4C97FF" },
    looks_blocks: { colourPrimary: "#9966FF" },
    sound_blocks: { colourPrimary: "#CF63CF" },
    event_blocks: { colourPrimary: "#FFBF00" },
    sensing_blocks: { colourPrimary: "#5CB1D6" },
    operators_blocks: { colourPrimary: "#59C059" },
  },
  categoryStyles: {
    logic_category: { colour: "#FFBF00" },
    loop_category: { colour: "#FFAB19" },
    math_category: { colour: "#59C059" },
    text_category: { colour: "#9966FF" },
    list_category: { colour: "#FF6680" },
    variable_category: { colour: "#FF8C1A" },
    procedure_category: { colour: "#FF6680" },
    motion_category: { colour: "#4C97FF" },
    looks_category: { colour: "#9966FF" },
    sound_category: { colour: "#CF63CF" },
    event_category: { colour: "#FFBF00" },
    sensing_category: { colour: "#5CB1D6" },
    operators_category: { colour: "#59C059" },
  },
  componentStyles: {
    workspaceBackgroundColour: "#F7F7F7",
    toolboxBackgroundColour: "#FFFFFF",
    flyoutBackgroundColour: "#FFFFFF",
    flyoutForegroundColour: "#333333",
    scrollbarColour: "#CCCCCC",
  },
});

/****************************** UTIL ***********************************/
/** Utility to safely get number input with fallback */
function valueToCodeNumber(
  block: Blockly.Block,
  name: string,
  defaultVal: number
) {
  const code = javascriptGenerator.valueToCode(block, name, ORDER_NONE);
  if (!code) return String(defaultVal);
  return `(${code})`;
}

/****************************** BLOCK DEFINITIONS ***********************************/
// Each category: motion (Gerakan), looks (Tampilan), sound (Suara), events (Peristiwa),
// control (Kontrol), sensing (Sensor), operators (Operator), variables (Variabel), procedures (Fungsi)

// Using any[] for broad compatibility with current Blockly TS defs (BlockDefinition not exported)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const blocksJson: any[] = [
  /* ================= Gerakan / Motion ================= */
  {
    type: "move_steps",
    message0: "gerak %1 langkah",
    args0: [{ type: "input_value", name: "STEPS", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    colour: "#4C97FF",
    tooltip: "Gerakkan objek sejumlah langkah",
    helpUrl: "",
  },
  {
    type: "turn_right",
    message0: "putar kanan %1 derajat",
    args0: [{ type: "input_value", name: "DEGREES", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    colour: "#4C97FF",
    tooltip: "Putar searah jarum jam",
    helpUrl: "",
  },
  {
    type: "turn_left",
    message0: "putar kiri %1 derajat",
    args0: [{ type: "input_value", name: "DEGREES", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    colour: "#4C97FF",
    tooltip: "Putar berlawanan jarum jam",
    helpUrl: "",
  },
  {
    type: "go_to_xy",
    message0: "pergi ke x %1 y %2",
    args0: [
      { type: "input_value", name: "X", check: "Number" },
      { type: "input_value", name: "Y", check: "Number" },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: "#4C97FF",
    tooltip: "Pergi ke posisi (x,y)",
    helpUrl: "",
  },
  {
    type: "change_x_by",
    message0: "ubah x sebanyak %1",
    args0: [{ type: "input_value", name: "DX", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    colour: "#4C97FF",
    tooltip: "Geser posisi x",
    helpUrl: "",
  },
  {
    type: "change_y_by",
    message0: "ubah y sebanyak %1",
    args0: [{ type: "input_value", name: "DY", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    colour: "#4C97FF",
    tooltip: "Geser posisi y",
    helpUrl: "",
  },
  /* ================= Tampilan / Looks ================= */
  {
    type: "say_for_seconds",
    message0: "katakan %1 selama %2 detik",
    args0: [
      { type: "input_value", name: "TEXT", check: "String" },
      { type: "input_value", name: "SECONDS", check: "Number" },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: "#9966FF",
    tooltip: "Tampilkan teks sementara",
    helpUrl: "",
  },
  {
    type: "say",
    message0: "katakan %1",
    args0: [{ type: "input_value", name: "TEXT", check: "String" }],
    previousStatement: null,
    nextStatement: null,
    colour: "#9966FF",
    tooltip: "Tampilkan teks",
    helpUrl: "",
  },
  {
    type: "think",
    message0: "pikirkan %1",
    args0: [{ type: "input_value", name: "TEXT", check: "String" }],
    previousStatement: null,
    nextStatement: null,
    colour: "#9966FF",
    tooltip: "Balon pikiran",
    helpUrl: "",
  },
  {
    type: "change_size_by",
    message0: "ubah ukuran sebesar %1 %",
    args0: [{ type: "input_value", name: "DELTA", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    colour: "#9966FF",
    tooltip: "Ubah ukuran relatif",
    helpUrl: "",
  },
  {
    type: "set_size_to",
    message0: "atur ukuran ke %1 %",
    args0: [{ type: "input_value", name: "SIZE", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    colour: "#9966FF",
    tooltip: "Set ukuran absolut",
    helpUrl: "",
  },
  {
    type: "upload_sprite",
    message0: "unggah sprite gambar",
    previousStatement: null,
    nextStatement: null,
    colour: "#9966FF",
    tooltip: "Unggah file gambar sebagai sprite",
    helpUrl: "",
  },
  /* ================= Suara / Sound ================= */
  {
    type: "play_sound",
    message0: "mainkan suara %1",
    args0: [{ type: "field_input", name: "SOUND", text: "pop" }],
    previousStatement: null,
    nextStatement: null,
    colour: "#CF63CF",
    tooltip: "Mainkan suara (simulasi)",
    helpUrl: "",
  },
  {
    type: "stop_all_sounds",
    message0: "hentikan semua suara",
    previousStatement: null,
    nextStatement: null,
    colour: "#CF63CF",
    tooltip: "Stop suara (simulasi)",
    helpUrl: "",
  },
  /* ================= Peristiwa / Events ================= */
  {
    type: "when_flag_clicked",
    message0: "ketika bendera diklik",
    message1: "%1",
    args1: [{ type: "input_statement", name: "DO" }],
    colour: "#FFBF00",
    tooltip: "Mulai saat bendera diklik",
    helpUrl: "",
  },
  {
    type: "when_key_pressed",
    message0: "ketika tombol %1 ditekan",
    args0: [{ type: "field_input", name: "KEY", text: "spasi" }],
    message1: "%1",
    args1: [{ type: "input_statement", name: "DO" }],
    colour: "#FFBF00",
    tooltip: "Mulai saat tombol ditekan",
    helpUrl: "",
  },

  /* ================= Kontrol / Control ================= */
  {
    type: "wait_seconds",
    message0: "tunggu %1 detik",
    args0: [{ type: "input_value", name: "SECONDS", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    colour: "#FFAB19",
    tooltip: "Tunda eksekusi",
    helpUrl: "",
  },
  {
    type: "repeat_times",
    message0: "ulangi %1 kali %2 lakukan %3",
    args0: [
      { type: "input_value", name: "TIMES", check: "Number" },
      { type: "input_dummy" },
      { type: "statement_input", name: "DO" },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: "#FFAB19",
    tooltip: "Ulangi beberapa kali",
    helpUrl: "",
  },
  {
    type: "if_then",
    message0: "jika %1 maka %2",
    args0: [
      { type: "input_value", name: "COND", check: "Boolean" },
      { type: "statement_input", name: "DO" },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: "#FFAB19",
    tooltip: "Kondisional",
    helpUrl: "",
  },
  {
    type: "if_then_else",
    message0: "jika %1 maka %2 jika tidak %3",
    args0: [
      { type: "input_value", name: "COND", check: "Boolean" },
      { type: "statement_input", name: "DO" },
      { type: "statement_input", name: "ELSE" },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: "#FFAB19",
    tooltip: "Kondisional dengan else",
    helpUrl: "",
  },
  /* ================= Sensor / Sensing ================= */
  {
    type: "touching_object",
    message0: "menyentuh objek %1 ?",
    args0: [{ type: "input_value", name: "TARGET", check: "String" }],
    output: "Boolean",
    colour: "#5CB1D6",
    tooltip: "Apakah menyentuh objek",
    helpUrl: "",
  },
  {
    type: "mouse_x",
    message0: "mouse x",
    output: "Number",
    colour: "#5CB1D6",
    tooltip: "Posisi X mouse",
    helpUrl: "",
  },
  {
    type: "mouse_y",
    message0: "mouse y",
    output: "Number",
    colour: "#5CB1D6",
    tooltip: "Posisi Y mouse",
    helpUrl: "",
  },
  /* ================= Operator / Operators ================= */
  {
    type: "operator_add",
    message0: "%1 + %2",
    args0: [
      { type: "input_value", name: "A", check: "Number" },
      { type: "input_value", name: "B", check: "Number" },
    ],
    output: "Number",
    colour: "#59C059",
    tooltip: "Penjumlahan",
    helpUrl: "",
  },
  {
    type: "operator_equals",
    message0: "%1 = %2",
    args0: [
      { type: "input_value", name: "A" },
      { type: "input_value", name: "B" },
    ],
    output: "Boolean",
    colour: "#59C059",
    tooltip: "Kesetaraan",
    helpUrl: "",
  },
  /* ================= Variabel / Variables ================= */
  // Rely on built-in dynamic variables category; add helper custom block example
  {
    type: "set_variable_number",
    message0: "atur %1 ke angka %2",
    args0: [
      { type: "field_variable", name: "VAR", variable: "variabel" },
      { type: "input_value", name: "VALUE", check: "Number" },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: "#FF8C1A",
    tooltip: "Set variabel ke angka",
    helpUrl: "",
  },
  /* ================= Fungsi / Procedures ================= */
  // Use built-in procedure blocks (PROCEDURE category); add a call sample? Not needed.
];

export function defineIndonesianScratchBlocks() {
  // Use internal module-scoped flag instead of mutating ESM namespace (which is read-only)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = defineIndonesianScratchBlocks as any;
  if (g.__defined) return;
  Blockly.defineBlocksWithJsonArray(blocksJson);
  g.__defined = true;
}

/****************************** GENERATORS ***********************************/
// Basic simulation: output console.log or arithmetic results.

javascriptGenerator["move_steps"] = function (block: Blockly.Block) {
  const steps = valueToCodeNumber(block, "STEPS", 10);
  return `console.log('Gerak ${steps} langkah');\n`;
};
javascriptGenerator["turn_right"] = function (block: Blockly.Block) {
  const deg = valueToCodeNumber(block, "DEGREES", 15);
  return `console.log('Putar kanan ' + ${deg} + ' derajat');\n`;
};
javascriptGenerator["turn_left"] = function (block: Blockly.Block) {
  const deg = valueToCodeNumber(block, "DEGREES", 15);
  return `console.log('Putar kiri ' + ${deg} + ' derajat');\n`;
};
javascriptGenerator["go_to_xy"] = function (block: Blockly.Block) {
  const x = valueToCodeNumber(block, "X", 0);
  const y = valueToCodeNumber(block, "Y", 0);
  return `console.log('Pergi ke (' + ${x} + ', ' + ${y} + ')');\n`;
};
javascriptGenerator["change_x_by"] = function (block: Blockly.Block) {
  const dx = valueToCodeNumber(block, "DX", 10);
  return `console.log('Ubah x sebanyak ' + ${dx});\n`;
};
javascriptGenerator["change_y_by"] = function (block: Blockly.Block) {
  const dy = valueToCodeNumber(block, "DY", 10);
  return `console.log('Ubah y sebanyak ' + ${dy});\n`;
};

javascriptGenerator["say_for_seconds"] = function (block: Blockly.Block) {
  const text =
    javascriptGenerator.valueToCode(block, "TEXT", ORDER_NONE) || `'Halo'`;
  const secs = valueToCodeNumber(block, "SECONDS", 2);
  return `console.log('Katakan sementara: ' + ${text} + ' (' + ${secs} + ' dtk)');\n`;
};
javascriptGenerator["say"] = function (block: Blockly.Block) {
  const text =
    javascriptGenerator.valueToCode(block, "TEXT", ORDER_NONE) || `'Halo'`;
  return `console.log('Katakan: ' + ${text});\n`;
};
javascriptGenerator["think"] = function (block: Blockly.Block) {
  const text =
    javascriptGenerator.valueToCode(block, "TEXT", ORDER_NONE) || `'Hmm'`;
  return `console.log('Pikirkan: ' + ${text});\n`;
};
javascriptGenerator["change_size_by"] = function (block: Blockly.Block) {
  const d = valueToCodeNumber(block, "DELTA", 10);
  return `console.log('Ubah ukuran: ' + ${d});\n`;
};
javascriptGenerator["set_size_to"] = function (block: Blockly.Block) {
  const s = valueToCodeNumber(block, "SIZE", 100);
  return `console.log('Set ukuran ke ' + ${s});\n`;
};
javascriptGenerator["upload_sprite"] = function () {
  return `console.log('Upload sprite (implementasi UI terpisah)');\n`;
};

javascriptGenerator["play_sound"] = function (block: Blockly.Block) {
  const sound = block.getFieldValue("SOUND") || "suara";
  return `console.log('Mainkan suara: ${sound}');\n`;
};
javascriptGenerator["stop_all_sounds"] = function () {
  return `console.log('Hentikan semua suara');\n`;
};

// Event hats: instead of executing immediately when generating code, we register
// handlers into an array window.__scratchEvents then a runtime bootstrap will run them.
// This avoids immediate execution order issues and lets us run all hats after load.
javascriptGenerator["when_flag_clicked"] = function (block: Blockly.Block) {
  const branch = javascriptGenerator.statementToCode(block, "DO");
  const code =
    `window.__scratchEvents = window.__scratchEvents || { flag: [], keys: {} };\n` +
    `window.__scratchEvents.flag.push(async function(){\n${branch}});\n`;
  return code;
};

javascriptGenerator["when_key_pressed"] = function (block: Blockly.Block) {
  const key = (block.getFieldValue("KEY") || "spasi").toLowerCase();
  const branch = javascriptGenerator.statementToCode(block, "DO");
  const code =
    `window.__scratchEvents = window.__scratchEvents || { flag: [], keys: {} };\n` +
    `window.__scratchEvents.keys['${key}'] = window.__scratchEvents.keys['${key}'] || [];\n` +
    `window.__scratchEvents.keys['${key}'].push(async function(){\n${branch}});\n`;
  return code;
};

javascriptGenerator["wait_seconds"] = function (block: Blockly.Block) {
  const secs = valueToCodeNumber(block, "SECONDS", 1);
  return `await new Promise(r=>setTimeout(r, 1000*${secs}));\n`;
};
javascriptGenerator["repeat_times"] = function (block: Blockly.Block) {
  const t = valueToCodeNumber(block, "TIMES", 10);
  const branch = javascriptGenerator.statementToCode(block, "DO");
  return `for(let i=0;i<${t};i++){\n${branch}}\n`;
};
javascriptGenerator["if_then"] = function (block: Blockly.Block) {
  const cond =
    javascriptGenerator.valueToCode(block, "COND", ORDER_LOGICAL_OR) || "false";
  const branch = javascriptGenerator.statementToCode(block, "DO");
  return `if(${cond}){\n${branch}}\n`;
};
javascriptGenerator["if_then_else"] = function (block: Blockly.Block) {
  const cond =
    javascriptGenerator.valueToCode(block, "COND", ORDER_LOGICAL_OR) || "false";
  const branch = javascriptGenerator.statementToCode(block, "DO");
  const branch2 = javascriptGenerator.statementToCode(block, "ELSE");
  return `if(${cond}){\n${branch}} else {\n${branch2}}\n`;
};

javascriptGenerator["touching_object"] = function (block: Blockly.Block) {
  const target =
    javascriptGenerator.valueToCode(block, "TARGET", ORDER_NONE) || `'tepi'`;
  const code = `/*sentuh ${target}*/(Math.random()>0.5)`;
  return [code, ORDER_LOGICAL_OR];
};
javascriptGenerator["mouse_x"] = function () {
  return ["(window._blocklyMouseX||0)", ORDER_NONE];
};
javascriptGenerator["mouse_y"] = function () {
  return ["(window._blocklyMouseY||0)", ORDER_NONE];
};

javascriptGenerator["operator_add"] = function (block: Blockly.Block) {
  const a = javascriptGenerator.valueToCode(block, "A", ORDER_ADDITION) || "0";
  const b = javascriptGenerator.valueToCode(block, "B", ORDER_ADDITION) || "0";
  return [`(${a}+${b})`, ORDER_ADDITION];
};
javascriptGenerator["operator_equals"] = function (block: Blockly.Block) {
  const a = javascriptGenerator.valueToCode(block, "A", ORDER_EQUALITY) || "0";
  const b = javascriptGenerator.valueToCode(block, "B", ORDER_EQUALITY) || "0";
  return [`(${a}==${b})`, ORDER_EQUALITY];
};

javascriptGenerator["set_variable_number"] = function (block: Blockly.Block) {
  const variable = javascriptGenerator.nameDB_.getName(
    block.getFieldValue("VAR"),
    Blockly.VARIABLE_CATEGORY_NAME
  );
  const val =
    javascriptGenerator.valueToCode(block, "VALUE", ORDER_NONE) || "0";
  return `${variable} = ${val};\n`;
};

// Safety: ensure every defined block has at least a stub generator so Blockly doesn't throw.
for (const def of blocksJson) {
  const t = (def as { type?: string }).type;
  if (!t) continue;
  if (!javascriptGenerator[t]) {
    javascriptGenerator[t] = function () {
      return `/* generator missing for ${t} */`;
    };
  }
}

/****************************** TOOLBOX ***********************************/
export const INDONESIAN_SCRATCH_TOOLBOX_XML = `<xml xmlns="https://developers.google.com/blockly/xml" id="toolbox" style="display:none">
  <category name="Gerakan" colour="#4C97FF">
    <block type="move_steps"><value name="STEPS"><shadow type="math_number"><field name="NUM">10</field></shadow></value></block>
    <block type="turn_right"><value name="DEGREES"><shadow type="math_number"><field name="NUM">15</field></shadow></value></block>
    <block type="turn_left"><value name="DEGREES"><shadow type="math_number"><field name="NUM">15</field></shadow></value></block>
    <block type="go_to_xy"><value name="X"><shadow type="math_number"><field name="NUM">0</field></shadow></value><value name="Y"><shadow type="math_number"><field name="NUM">0</field></shadow></value></block>
    <block type="change_x_by"><value name="DX"><shadow type="math_number"><field name="NUM">10</field></shadow></value></block>
    <block type="change_y_by"><value name="DY"><shadow type="math_number"><field name="NUM">10</field></shadow></value></block>
  </category>
  <category name="Tampilan" colour="#9966FF">
    <block type="say_for_seconds"><value name="TEXT"><shadow type="text"><field name="TEXT">Halo</field></shadow></value><value name="SECONDS"><shadow type="math_number"><field name="NUM">2</field></shadow></value></block>
    <block type="say"><value name="TEXT"><shadow type="text"><field name="TEXT">Halo</field></shadow></value></block>
    <block type="think"><value name="TEXT"><shadow type="text"><field name="TEXT">Hmm...</field></shadow></value></block>
    <block type="change_size_by"><value name="DELTA"><shadow type="math_number"><field name="NUM">10</field></shadow></value></block>
    <block type="set_size_to"><value name="SIZE"><shadow type="math_number"><field name="NUM">100</field></shadow></value></block>
    <block type="upload_sprite"></block>
  </category>
  <category name="Suara" colour="#CF63CF">
    <block type="play_sound"></block>
    <block type="stop_all_sounds"></block>
  </category>
  <category name="Peristiwa" colour="#FFBF00">
    <block type="when_flag_clicked"></block>
    <block type="when_key_pressed"><field name="KEY">spasi</field></block>
  </category>
  <category name="Kontrol" colour="#FFAB19">
    <block type="wait_seconds"><value name="SECONDS"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block>
    <block type="repeat_times"><value name="TIMES"><shadow type="math_number"><field name="NUM">10</field></shadow></value></block>
    <block type="if_then"></block>
    <block type="if_then_else"></block>
  </category>
  <category name="Sensor" colour="#5CB1D6">
    <block type="touching_object"><value name="TARGET"><shadow type="text"><field name="TEXT">tepi</field></shadow></value></block>
    <block type="mouse_x"></block>
    <block type="mouse_y"></block>
  </category>
  <category name="Operator" colour="#59C059">
    <block type="operator_add"></block>
    <block type="operator_equals"></block>
    <block type="math_number"><field name="NUM">0</field></block>
    <block type="text"><field name="TEXT">teks</field></block>
  </category>
  <category name="Variabel" colour="#FF8C1A" custom="VARIABLE_DYNAMIC">
    <block type="set_variable_number"><value name="VALUE"><shadow type="math_number"><field name="NUM">0</field></shadow></value></block>
  </category>
  <category name="Fungsi" colour="#FF6680" custom="PROCEDURE"></category>
</xml>`;

/****************************** INJECT HELPER ***********************************/
export function injectIndonesianScratchBlockly(
  divId: string,
  overrides: Partial<Blockly.BlocklyOptions> = {}
) {
  defineIndonesianScratchBlocks();
  return Blockly.inject(divId, {
    toolbox: INDONESIAN_SCRATCH_TOOLBOX_XML,
    renderer: "zelos",
    theme: ScratchTheme,
    collapse: true,
    comments: true,
    disable: false,
    trashcan: true,
    scrollbars: true,
    horizontalLayout: false,
    ...overrides,
  });
}

/****************************** NOTES ***********************************/
// 1. All generators currently log to console. Replace with real game/engine updates later.
// 2. Add more blocks as needed (costumes, broadcast, cloning) by extending blocksJson & toolbox.
// 3. The event blocks here simply execute immediately (flag) or attach key listeners.
// 4. For async control (wait), ensure wrapper code runs in async context when executing generated JS.

const IndonesianScratchBundle = {
  ScratchTheme,
  defineIndonesianScratchBlocks,
  injectIndonesianScratchBlockly,
  INDONESIAN_SCRATCH_TOOLBOX_XML,
};

export default IndonesianScratchBundle;
