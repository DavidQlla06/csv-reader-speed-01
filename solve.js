// Fast drop-in for csv-reader 1.0.0: run(input) returns exactly readCsv's
// {columns, rows, errors} for every input {text, header}.
// Single left-to-right pass; each record finds its line end once, unquoted
// fields end at indexOf jumps, quoted fields jump quote to quote; fields
// are slices, never built char by char.

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  const len = text.length;
  let pos = 0;
  let line = 1;
  if (len > 0 && text.charCodeAt(0) === 0xFEFF) pos = 1;

  const crPos = [];
  for (let i = text.indexOf('\r'); i !== -1; i = text.indexOf('\r', i + 1)) crPos.push(i);
  let crIdx = 0;
  let nextCr = crPos.length > 0 ? crPos[0] : -1;

  let recordLine = 1;
  let recordRow = null;

  let uValue = '';
  let uEnded = 2;
  let uAdded = 0;

  function scanUnquotedSlow(prefix) {
    let parts = null;
    let added = 0;
    let start = pos;
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 44) {
        const seg = text.slice(start, pos);
        added += seg.length;
        pos += 1;
        uValue = parts ? prefix + parts.join('') + seg : (prefix ? prefix + seg : seg);
        uEnded = 0; uAdded = added;
        return;
      }
      if (c === 10) {
        const seg = text.slice(start, pos);
        added += seg.length;
        pos += 1;
        line += 1;
        uValue = parts ? prefix + parts.join('') + seg : (prefix ? prefix + seg : seg);
        uEnded = 1; uAdded = added;
        return;
      }
      if (c === 13) {
        if (text.charCodeAt(pos + 1) === 10) {
          const seg = text.slice(start, pos);
          added += seg.length;
          pos += 2;
          line += 1;
          uValue = parts ? prefix + parts.join('') + seg : (prefix ? prefix + seg : seg);
          uEnded = 1; uAdded = added;
          return;
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        const seg = text.slice(start, pos);
        added += seg.length;
        if (parts === null) parts = [seg]; else parts.push(seg);
        pos += 1;
        start = pos;
        continue;
      }
      pos += 1;
    }
    const seg = text.slice(start, pos);
    added += seg.length;
    uValue = parts ? prefix + parts.join('') + seg : (prefix ? prefix + seg : seg);
    uEnded = 2; uAdded = added;
  }

  // Quoted segment [s,e): CRLF/lone CR -> LF, lines counted.
  function quotedSegStr(s, e) {
    while (nextCr !== -1 && nextCr < s) { crIdx++; nextCr = crIdx < crPos.length ? crPos[crIdx] : -1; }
    const hasCr = nextCr !== -1 && nextCr < e;
    if (!hasCr) {
      const n = text.indexOf('\n', s);
      if (n === -1 || n >= e) return text.slice(s, e);
      let cnt = 0;
      for (let i = n; i !== -1 && i < e; i = text.indexOf('\n', i + 1)) cnt++;
      line += cnt;
      return text.slice(s, e);
    }
    let out = '';
    let segStart = s;
    for (let i = s; i < e; i++) {
      const c = text.charCodeAt(i);
      if (c === 13) {
        out += text.slice(segStart, i) + '\n';
        line += 1;
        if (text.charCodeAt(i + 1) === 10) i += 1;
        segStart = i + 1;
      } else if (c === 10) {
        line += 1;
      }
    }
    out += text.slice(segStart, e);
    return out;
  }

  function scanQuoted() {
    const open = pos;
    const openLine = line;
    const openCrIdx = crIdx;
    const openNextCr = nextCr;
    let i = pos + 1;
    let segStart = i;
    let value = null;
    let parts = null;
    let closed = false;
    while (true) {
      const q = text.indexOf('"', i);
      if (q === -1) break;
      if (text.charCodeAt(q + 1) === 34) {
        const seg = quotedSegStr(segStart, q);
        if (parts === null) {
          if (value === null) value = seg;
          else parts = [value, seg];
        } else parts.push(seg);
        if (parts === null) value += '"'; else parts.push('"');
        i = q + 2;
        segStart = i;
        continue;
      }
      const seg = quotedSegStr(segStart, q);
      if (parts === null) value = value === null ? seg : value + seg;
      else { parts.push(seg); value = parts.join(''); }
      pos = q + 1;
      closed = true;
      break;
    }
    if (!closed) {
      pos = open + 1;
      line = openLine;
      crIdx = openCrIdx;
      nextCr = openNextCr;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      scanUnquotedSlow('"');
      return;
    }
    if (pos >= len) { uValue = value; uEnded = 2; return; }
    const c = text.charCodeAt(pos);
    if (c === 44) { pos += 1; uValue = value; uEnded = 0; return; }
    if (c === 10) { pos += 1; line += 1; uValue = value; uEnded = 1; return; }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line += 1; uValue = value; uEnded = 1; return; }
    scanUnquotedSlow(value);
    if (uAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
  }

  while (true) {
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) { pos += 1; line += 1; }
      else if (c === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line += 1; }
      else break;
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let lastQuoted = false;
    let nlAt = text.indexOf('\n', pos);
    let lineEnd = nlAt === -1 ? len : nlAt;
    let ended;
    do {
      if (pos > lineEnd) {
        nlAt = text.indexOf('\n', pos);
        lineEnd = nlAt === -1 ? len : nlAt;
      }
      const quoted = text.charCodeAt(pos) === 34;
      lastQuoted = quoted;
      if (quoted) {
        scanQuoted();
        fields.push(uValue);
        ended = uEnded;
      } else {
        const iComma = text.indexOf(',', pos);
        let end;
        if (iComma !== -1 && iComma < lineEnd) { end = iComma; ended = 0; }
        else if (nlAt !== -1) { end = lineEnd; ended = 1; }
        else { end = len; ended = 2; }
        while (nextCr !== -1 && nextCr < pos) { crIdx++; nextCr = crIdx < crPos.length ? crPos[crIdx] : -1; }
        if (nextCr !== -1 && nextCr < end) {
          if (ended === 1 && nextCr === end - 1) {
            fields.push(text.slice(pos, end - 1));
            pos = end + 1;
            line += 1;
          } else {
            scanUnquotedSlow('');
            fields.push(uValue);
            ended = uEnded;
          }
        } else {
          fields.push(text.slice(pos, end));
          if (ended === 0) pos = end + 1;
          else if (ended === 1) { pos = end + 1; line += 1; }
          else pos = end;
        }
      }
    } while (ended === 0);

    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
