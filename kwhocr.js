const colorthreshold = 120;
// ignore features at edge
const hThreshold = 50;
const vThreshold = 50;
// number of digits
const ndigits = 6;
const recognitionTable = {
  "2,4,4,4,2": 0,
  "2,2,4,2,2": 4,
  "2,2,2,2,2": 7,
  "2,2,2,4,2": 6,
  "2,4,2,4,2": 8,
  "2,4,2,2,2": 9
};

class Box {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.pixels = ctx.getImageData(this.x, this.y, this.width, this.height);
  }

  show(color) {
    ctx.strokeStyle = color;
    ctx.strokeRect(this.x, this.y, this.width, this.height);
  }

  isWhite(x, y) {
    const data = this.pixels.data;
    const i = y * (this.width * 4) + x * 4;
    //return (data[i] + data[i + 1] + data[i + 2]) / 3 > colorthreshold ? 255 : 0;
    return data[i] > colorthreshold;
  }

  setPixel(x, y, red, green, blue) {
    const data = this.pixels.data;
    const i = y * (this.width * 4) + x * 4;
    data[i] = red;
    data[i + 1] = green;
    data[i + 2] = blue;
  }

  blackWhite() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const color = this.isWhite(x, y) ? 255 : 0;
        this.setPixel(x, y, color, color, color);
      }
    }
    ctx.putImageData(this.pixels, this.x, this.y);
  }
}

function setImgBox() {
  return new Box(
    hThreshold,
    vThreshold,
    img.width - 2 * hThreshold,
    img.height - 2 * vThreshold
  );
}

// search the image for the bounding box
function findBoundingBox(box) {
  let startX = Infinity;
  let startY = Infinity;
  let endX = -Infinity;
  let endY = -Infinity;

  for (let y = 0; y < box.height; y++) {
    // reset counters
    let black = 0;
    let edge = 0;
    for (let x = 0; x < box.width; x++) {
      if (box.isWhite(x, y)) {
        if (black > box.width / 6) {
          //ctx.strokeRect(x + box.x, y + box.y, 1, 1);
          edge++;
          if (edge > 1) {
            if (x > endX) endX = x;
            if (startX > x - black) startX = x - black;
          }
        }
        black = 0;
      } else {
        black++;
      }
    }
    if (edge > 1) {
      if (y > endY) endY = y;
      if (startY > y) startY = y;
    }
  }
  const width = endX - startX;
  const height = endY - startY;
  if (width > box.width || height > box.height) {
    throw "can't find bounding box";
  }
  return new Box(box.x + startX, box.y + startY, width, height);
}

// find the innerbox where the segments live.
function findInnerBox(box) {
  const middleX = Math.floor(box.width / 2);
  const middleY = Math.floor(box.height / 2);

  let edge, prev;
  let leftX = 0;
  let rightX = box.width;
  let topY = 0;
  let bottomY = box.height;

  // left X
  edge = 0;
  prev = false; //dark

  while (leftX < rightX && edge < 2) {
    let current = box.isWhite(leftX, middleY);
    if (prev != current) {
      prev = current;
      edge++;
    }
    leftX++;
  }

  // right X
  edge = 0;
  prev = false;
  while (rightX > leftX && edge < 2) {
    let current = box.isWhite(rightX, middleY);
    if (prev != current) {
      prev = current;
      edge++;
    }
    rightX--;
  }

  // top Y
  edge = 0;
  prev = false; //dark

  while (topY < bottomY && edge < 2) {
    let current = box.isWhite(middleX, topY);
    if (prev != current) {
      prev = current;
      edge++;
    }
    topY++;
  }

  // bottom Y
  edge = 0;
  prev = false; //dark

  while (bottomY > topY && edge < 2) {
    let current = box.isWhite(middleX, bottomY);
    if (prev != current) {
      prev = current;
      edge++;
    }
    bottomY--;
  }
  const width = rightX - leftX;
  const height = bottomY - topY;
  return new Box(box.x + leftX, box.y + topY, width, height);
}

function findSegments(box) {
  let segments = [];
  // scan vertically for (nearly) black rows
  const whiteThreshold = box.height / 10;
  let prev;
  let edges = [];

  for (let x = 0; x < box.width; x++) {
    let white = 0;
    for (let y = 0; y < box.height; y++) {
      if (box.isWhite(x, y)) white++;
    }
    // does the first column contain data ?
    if (x == 0) {
      prev = white > whiteThreshold;
      if (prev) edges.push(0);
    }
    // did we find an edge ?
    if (
      (white > whiteThreshold && prev == false) ||
      (white <= whiteThreshold && prev == true)
    ) {
      prev = !prev;
      edges.push(x);
    }
  }
  // if we missed the last edge then add it
  if (edges.length % 2) {
    edges.push(box.width);
  }

  for (let i = 0; i < edges.length; i = i + 2) {
    const width = edges[i + 1] - edges[i];
    segments.push(new Box(box.x + edges[i], box.y, width, box.height));
  }
  return segments;
}

function trimSegment(box) {
  // remove partial digits at top and or bottom

  // scan horizontally
  let prev;
  let edges = [];
  const whiteThreshold = Math.round(box.width / 10);
  for (let y = 0; y < box.height; y++) {
    let white = 0;
    for (let x = 0; x < box.width; x++) {
      if (box.isWhite(x, y)) white++;
    }
    // does the first row contain data ?
    if (y === 0) {
      prev = white > whiteThreshold;
      if (prev) edges.push(0);
    }
    // did we find an edge ?
    if (
      (white > whiteThreshold && prev == false) ||
      (white <= whiteThreshold && prev == true)
    ) {
      prev = !prev;
      edges.push(y);
    }
  }
  // if we missed the last edge then add it
  if (edges.length % 2) {
    edges.push(box.height);
  }
  // find an acceptable block
  for (let i = 0; i < edges.length; i = i + 2) {
    height = edges[i + 1] - edges[i];
    if (height > box.height / 2) {
      return new Box(box.x, box.y + edges[i], box.width, height);
    }
  }
  throw "can't find a usable segment part";
}

function parseSegment(box) {
  // scan horizontally

  const nSections = 5;
  let histogram = [];
  const size = Math.round(box.height / nSections);

  for (let y = 0; y < box.height; y++) {
    const sectionIndex = Math.floor(y / size);
    let edges = 0;
    let prev = false; //start with black
    let current;
    for (let x = 0; x < box.width; x++) {
      current = box.isWhite(x, y);
      if (current != prev) {
        edges++;
        prev = current;
      }
    }
    // if we end with white we add an edge
    if (current) {
      edges++;
    }
    // record the edges in a histogram per section
    if (typeof histogram[sectionIndex] !== "object") {
      histogram[sectionIndex] = Array(10).fill(0);
    }
    histogram[sectionIndex][edges]++;
  }

  // find the maximum occurence of number of edges per section and turn it into a string
  const signature = histogram
    .map(section => section.indexOf(Math.max(...section)))
    .join();
  // lookup the string in the table to get the digit
  return recognitionTable[signature];
}

function* stepper() {
  yield "Set the outer box";
  const imgBox = setImgBox();
  imgBox.show("blue");
  yield "Find bounding box";
  const boundingBox = findBoundingBox(imgBox);
  boundingBox.show("red");
  yield "Find segments";
  const innerBox = findInnerBox(boundingBox);
  const segments = findSegments(innerBox);
  const trimmedSegments = segments.map(item => trimSegment(item));
  trimmedSegments.forEach(item => item.blackWhite());
  yield "Parse segments";
  const numbers = trimmedSegments.map(item => parseSegment(item));
  const scanResult = Number(numbers.join(""));
  result.innerHTML = `Scanresult: ${scanResult}`;
  yield "Done";
}

const img = new Image();
img.src = "kwm2.png";
const canvas = document.getElementById("canvas");
const result = document.getElementById("result");
const button = document.getElementById("button");
const ctx = canvas.getContext("2d");
img.onload = () => {
  ctx.drawImage(img, 0, 0);
  const step = stepper();
  button.onclick = () => {
    const value = step.next().value;
    button.textContent = value;
    if (value === "Done") {
      button.disabled = true;
    }
  };
};
