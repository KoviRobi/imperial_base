sections = document.getElementsByTagName("section");

for (let i = 0; i < sections.length; i++) {
  let div = document.createElement("div");
  div.classList.add("nav");

  let prev = document.createElement("a");
  prev.append("\u2190");
  if (i > 0) prev.href = `#${sections[i - 1].id}`;
  div.append(prev);

  let next = document.createElement("a");
  next.append("\u2192");
  if (i < sections.length - 1) next.href = `#${sections[i + 1].id}`;
  div.append(next);

  sections[i].append(div);
}
