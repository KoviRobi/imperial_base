function BadCharException(char, base) {
  this.name = "BadCharException";
  this.message = `Bad character ${char} in base ${base}`;
}

function BadNumberException(number) {
  this.name = "BadNumberException";
  this.message = `Unable to parse number ${number}`;
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

function pretty_print_number(number, base) {
  if (base === undefined) base = 10;
  let [whole, fractional = []] = number.toString(base).split(".");
  let pretty = group_digits(whole).join("");
  if (fractional.length > 0) {
    pretty += "." + group_digits_reverse(fractional).join("");
  }
  return pretty;
}

function parse_digit(character, base) {
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
  if (index === 0) return parse_digit(char, 12);
  else if (index === 1) return parse_digit(char, 3);
  else if (index === 2) return parse_digit(char, 10);
  else if (index === 3) return parse_digit(char, 16);
  else if (index === 4) return parse_digit(char, 11);
  else return parse_digit(char, 36);
}

/** This function is mapped over the reversed char list */
function to_string_imperial_whole(digit, index) {
  if (index === 0) return digit.toString(12).toUpperCase();
  else if (index === 1) return digit.toString(3).toUpperCase();
  else if (index === 2) return digit.toString(10).toUpperCase();
  else if (index === 3) return digit.toString(16).toUpperCase();
  else if (index === 4) return digit.toString(11).toUpperCase();
  else return digit.toString(36).toUpperCase();
}

function parse_imperial(input_string) {
  let [whole, fractional = ""] = sanitize_imperial(input_string).split('"');

  fractional = Array.from(fractional, (c) => parse_digit(c, 16));

  whole = Array.from(whole).reverse().map(parse_imperial_whole);

  return [whole, fractional];
}

function to_string_imperial(imperial) {
  let [whole, fractional] = imperial;
  fractional = fractional.map((digit) => digit.toString(16).toUpperCase());
  whole = whole.map(to_string_imperial_whole);
  return (
    group_digits_reverse(whole).reverse().join("") +
    "\u2033" +
    group_digits_reverse(fractional).join("")
  );
}

/** This function is reduced over the reversed char list */
function imperial_whole_to_inches(prev, digit, index) {
  if (index >= 1) digit = digit * 12;
  if (index >= 2) digit = digit * 3;
  if (index >= 3) digit = digit * 10;
  if (index >= 4) digit = digit * 16;
  if (index >= 5) digit = digit * 11;
  for (let i = index; i >= 6; i--) digit = digit * 36;
  return digit + prev;
}

function imperial_to_inches(imperial) {
  let [whole, fractional] = imperial;
  whole = whole.reduce(imperial_whole_to_inches, 0);

  let frac_reducer = (prev, digit, index) => digit / 16 ** (index + 1) + prev;
  fractional = fractional.reduce(frac_reducer, 0);

  return whole + fractional;
}

function inches_to_imperial(inches) {
  if (Number.isNaN(inches) || !Number.isFinite(inches))
    throw new BadNumberException(inches);
  let fractional_array = [];
  let fractional = inches % 1;

  // IEEE 754 double-precision has 52 bits of significand, which is 13 * 4 (a
  // hex digit is 4 bits), so truncate to 13 hex digits max
  for (let i = 0; i < 13 && Math.abs(fractional) > Number.EPSILON; i++) {
    fractional = fractional * 16;
    fractional_array.push(Math.trunc(fractional));
    fractional = fractional % 1;
  }

  let whole_array = [];
  let whole = Math.trunc(inches);

  for (const base of [12, 3, 10, 16, 11]) {
    if (whole === 0) break;
    let part = whole % base;
    whole_array.push(part);
    whole = Math.trunc(whole / base);
  }

  while (whole !== 0) {
    let part = whole % 36;
    whole_array.push(part);
    whole = Math.trunc(whole / 36);
  }

  return [whole_array, fractional_array];
}

function to_unit(inches, unit) {
  if (unit === "feet") return inches / 12;
  else if (unit === "yards") return inches / 36;
  else if (unit === "miles") return inches / 63360;
  else return inches;
}

function to_inches(value, unit) {
  if (unit === "feet") return value * 12;
  else if (unit === "yards") return value * 36;
  else if (unit === "miles") return value * 63360;
  else return value;
}

function get_decimal_inches(i) {
  number = Number(sanitize_number(decimal_inputs[i].value));
  if (Number.isNaN(number)) throw new BadNumberException(number);
  return to_inches(number, unit_inputs[i].value);
}

function set_imperial_inches(i, inches) {
  imperial = inches_to_imperial(inches);
  imperial_inputs[i].value = to_string_imperial(imperial);
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
    to_unit(inches, unit_inputs[i].value)
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
