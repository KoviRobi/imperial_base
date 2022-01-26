const imperial_base = { fractional: 16, whole: [12, 3, 22, 10, 8], rest: 36 };
const imperial_base_whole_units = [
  { name: "inches", symbol: "in" },
  { name: "feet", symbol: "ft" },
  { name: "yards", symbol: "yd" },
  { name: "chains", symbol: "ch" },
  { name: "furlongs", symbol: "fu" },
  { name: "miles", symbol: "mi" },
];

function BadCharException(char, base) {
  this.name = "BadCharException";
  this.message = `Bad character ${char} in base ${base}`;
}

function BadNumberException(number) {
  this.name = "BadNumberException";
  this.message = `Unable to parse number ${number}`;
}

function BadUnitException(unit) {
  this.name = "BadUnitException";
  this.message = `Unable to parse unit ${unit}`;
}

/** Remove spaces and comma digit grouping */
function sanitize_number(str) {
  return str.replaceAll(/,|\s/g, "");
}

function sanitize_imperial(str) {
  return sanitize_number(str)
    .replaceAll(/\u2018|\u2019|\u201B|\u2032|\u275B|\u275C|\u275F/g, "'")
    .replace(
      /''|\u201C|\u201F|\u201D|\u2033|\u275D|\u275E|\u301D|\u301E|\uFF02/,
      '"'
    );
}

function group_digits_reverse(chars) {
  let ret = [];
  let index = 0;
  for (char of chars) {
    ret.push(char);
    // Push a thin space
    if (index > 0 && index % 3 == 2) ret.push("\u2009");
    index++;
  }
  return ret;
}

function group_digits(chars) {
  let ret = [];
  let index = chars.length - 1;
  for (char of chars) {
    ret.push(char);
    // Push a thin space
    if (index > 0 && index % 3 == 0) ret.push("\u2009");
    index--;
  }
  return ret;
}

function pretty_print_number(number, base, decimal_places) {
  if (base === undefined) base = 10;
  let [mantissa, exponent = []] = number.toString(base).split("e");
  let [whole, fractional = []] = mantissa.split(".");
  if (decimal_places !== undefined)
    // This is truncate rather than round but is easier to implement
    fractional = fractional.slice(0, decimal_places);
  let pretty = group_digits(whole).join("");
  if (fractional.length > 0) {
    pretty += "." + group_digits_reverse(fractional).join("");
  }
  if (exponent.length > 0) {
    pretty += " e" + group_digits(exponent).join("");
  }
  return pretty;
}

function parse_digit(character, base) {
  if (base === undefined) base = 10;
  let number_value;
  let lc = character.toLowerCase();
  if ("0" <= lc && lc <= "9") number_value = Number(character);
  else if ("a" <= lc && lc <= "z")
    number_value = 10 + lc.charCodeAt() - "a".charCodeAt();
  else throw new BadCharException(character, base);

  if (number_value < base) return number_value;
  else throw new BadCharException(character, base);
}

/** This function is mapped over the reversed char list */
function parse_imperial_whole(char, index) {
  if (0 <= index && index < imperial_base.whole.length)
    return parse_digit(char, imperial_base.whole[index]);
  else return parse_digit(char, imperial_base.rest);
}

/** This function is mapped over the reversed char list */
function to_string_imperial_whole(digit, index) {
  if (0 <= index && index < imperial_base.whole.length)
    return digit.toString(imperial_base.whole[index]).toUpperCase();
  else return digit.toString(imperial_base.rest).toUpperCase();
}

function parse_imperial(input_string) {
  let pos = input_string.startsWith("+") || !input_string.startsWith("-");
  let abs = sanitize_imperial(input_string).replace(/^[+-]/, "");
  let [whole, fractional = ""] = abs.split('"');

  fractional = Array.from(fractional, (c) =>
    parse_digit(c, imperial_base.fractional)
  );

  whole = Array.from(whole).reverse().map(parse_imperial_whole);

  return [pos, whole, fractional];
}

function to_string_imperial(imperial, decimal_places) {
  let [pos, whole, fractional] = imperial;
  if (decimal_places !== undefined)
    // This is truncate rather than round but is easier to implement
    fractional = fractional.slice(0, decimal_places);
  fractional = fractional.map((digit) =>
    digit.toString(imperial_base.fractional).toUpperCase()
  );
  whole = whole.map(to_string_imperial_whole);
  return (
    (pos ? "" : "-") +
    group_digits_reverse(whole).reverse().join("") +
    "\u2033" +
    group_digits_reverse(fractional).join("")
  );
}

/** This function is reduced over the reversed char list */
function imperial_whole_to_inches(prev, digit, index) {
  for (let i = 1; i <= Math.min(index, imperial_base.whole.length); i++)
    digit = digit * imperial_base.whole[i - 1];
  for (let i = index; i > imperial_base.whole.length; i--)
    digit = digit * imperial_base.rest;
  return digit + prev;
}

function imperial_to_inches(imperial) {
  let [pos, whole, fractional] = imperial;
  whole = whole.reduce(imperial_whole_to_inches, 0);

  let frac_reducer = (prev, digit, index) =>
    digit / imperial_base.fractional ** (index + 1) + prev;
  fractional = fractional.reduce(frac_reducer, 0);

  return (pos ? 1 : -1) * (whole + fractional);
}

function inches_to_imperial(inches) {
  if (Number.isNaN(inches) || !Number.isFinite(inches))
    throw new BadNumberException(inches);
  let pos = inches >= 0;
  inches = Math.abs(inches);
  let fractional_array = [];
  let fractional = inches % 1;

  // IEEE 754 double-precision has 52 bits of significand, which is 13 * 4 (a
  // hex digit is 4 bits), so truncate to 13 hex digits max
  for (let i = 0; i < 13 && Math.abs(fractional) > Number.EPSILON; i++) {
    fractional = fractional * imperial_base.fractional;
    fractional_array.push(Math.trunc(fractional));
    fractional = fractional % 1;
  }

  let whole_array = [];
  let whole = Math.trunc(inches);

  for (const base of imperial_base.whole) {
    if (whole === 0) break;
    let part = whole % base;
    whole_array.push(part);
    whole = Math.trunc(whole / base);
  }

  base = imperial_base.rest;
  while (whole !== 0) {
    let part = whole % base;
    whole_array.push(part);
    whole = Math.trunc(whole / base);
  }

  return [pos, whole_array, fractional_array];
}

function to_unit(inches, unit) {
  let matched = false;
  for (let i = 0; i < imperial_base_whole_units.length; i++) {
    if (imperial_base_whole_units[i].name === unit) {
      matched = true;
      break;
    }
    inches = inches / imperial_base.whole[i];
  }

  if (!matched) throw new BadUnitException(unit);

  return inches;
}

function to_inches(value, unit) {
  let matched = false;
  for (let i = 0; i < imperial_base_whole_units.length; i++) {
    if (imperial_base_whole_units[i].name === unit) {
      matched = true;
      break;
    }
    value = value * imperial_base.whole[i];
  }

  if (!matched) throw new BadUnitException(unit);

  return value;
}

function get_decimal_inches(i) {
  number = Number(sanitize_number(decimal_inputs[i].value));
  if (Number.isNaN(number)) throw new BadNumberException(number);
  return to_inches(number, unit_inputs[i].value);
}

function set_imperial_inches(i, inches) {
  imperial = inches_to_imperial(inches);
  imperial_inputs[i].value = to_string_imperial(imperial, 5);
}

function update_imperial(i) {
  try {
    const inches = get_decimal_inches(i);
    set_imperial_inches(i, inches);
  } catch (error) {
    if (error instanceof BadNumberException)
      imperial_inputs[i].value = error.message;
    else imperial_inputs[i].value = error;
  }
}

function get_imperial_inches(i) {
  let imperial = parse_imperial(imperial_inputs[i].value);
  return imperial_to_inches(imperial);
}

function set_decimal_inches(i, inches) {
  decimal_inputs[i].value = pretty_print_number(
    to_unit(inches, unit_inputs[i].value),
    10,
    5
  );
}

function update_decimal(i) {
  try {
    const inches = imperial_inputs[i].get();
    set_decimal_inches(i, inches);
  } catch (error) {
    console.error(error);
    if (error instanceof BadCharException)
      decimal_inputs[i].value = error.message;
    else decimal_inputs[i].value = error;
  }
}

let last_changed_group = 0;
const last_changed = [, ,];
const imperial_inputs = [, ,];
const decimal_inputs = [, ,];
const unit_inputs = [, ,];
const perform_calculation = [, ,];
const operator = document.getElementById("operator");

for (let i = 0; i < 3; i++) {
  imperial_inputs[i] = document.getElementById(`imperial-${i}`);
  decimal_inputs[i] = document.getElementById(`decimal-${i}`);
  unit_inputs[i] = document.getElementById(`unit-${i}`);

  last_changed[i] = imperial_inputs[i];

  for (const unit of imperial_base_whole_units) {
    option = document.createElement("option");
    option.innerText = unit.symbol;
    option.value = unit.name;
    unit_inputs[i].append(option);
  }

  unit_inputs[i].addEventListener(
    "change",
    () => last_changed[i].recalculate(),
    false
  );

  imperial_inputs[i].get = () => get_imperial_inches(i);
  imperial_inputs[i].set = (inches) => set_imperial_inches(i, inches);
  imperial_inputs[i].recalculate = () => update_decimal(i);
  imperial_inputs[i].addEventListener(
    "input",
    () => {
      last_changed_group = i;
      last_changed[i] = imperial_inputs[i];
      imperial_inputs[i].recalculate();
      perform_calculation[i]();
    },
    false
  );

  decimal_inputs[i].get = () => get_decimal_inches(i);
  decimal_inputs[i].set = (inches) => set_decimal_inches(i, inches);
  decimal_inputs[i].recalculate = () => update_imperial(i);
  decimal_inputs[i].addEventListener(
    "input",
    () => {
      last_changed_group = i;
      last_changed[i] = decimal_inputs[i];
      decimal_inputs[i].recalculate();
      perform_calculation[i]();
    },
    false
  );
}

const operator_map = {
  add: (x, y) => x + y,
  sub: (x, y) => x - y,
  mult: (x, y) => x * y,
  div: (x, y) => x / y,
};
const reverse_operator_map = {
  add: (x, y) => x - y,
  sub: (x, y) => x + y,
  mult: (x, y) => x / y,
  div: (x, y) => x * y,
};

perform_calculation[0] = () => {
  a = last_changed[0].get();
  b = last_changed[1].get();
  last_changed[2].set(operator_map[operator.value](a, b));
  last_changed[2].recalculate();
};

perform_calculation[1] = perform_calculation[0];

perform_calculation[2] = () => {
  b = last_changed[1].get();
  c = last_changed[2].get();
  last_changed[0].set(reverse_operator_map[operator.value](b, c));
  last_changed[0].recalculate();
};

operator.addEventListener(
  "change",
  () => perform_calculation[last_changed_group](),
  false
);
