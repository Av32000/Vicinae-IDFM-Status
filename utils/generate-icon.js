import { readFileSync } from "fs";
import sharp from "sharp";

function generateLineIcon(line) {
  let width = 0;
  let height = 64;
  let borderRadius = 0;

  let bgColor = `#${line.colourweb_hexa}`;
  let textColor = `#${line.textcolourweb_hexa}`;

  let text = line.name_line.split(" ")[1] || line.name_line;

  switch (line.transportmode) {
    case "metro":
      width = 64;
      borderRadius = 360;
      break;

    case "rail":
      width = 64;
      borderRadius = 20;
      break;

    default:
      width = 96;
  }

  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${borderRadius}" fill="${bgColor}" />
      <text 
        x="50%" 
        y="50%" 
        dominant-baseline="central" 
        text-anchor="middle" 
        fill="${textColor}" 
        font-family="sans-serif" 
        font-weight="bold" 
        font-size="${Math.floor(height * 0.5)}px"
      >
        ${text}
      </text>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .png()
    .toFile(`./assets/${line.id_line}.png`)
    .then(() => {
      console.log(
        `Icon generated for line ${line.name_line} (${line.id_line})`,
      );
    })
    .catch((err) => {
      console.error(
        `Error generating icon for line ${line.name_line} (${line.id_line}):`,
        err,
      );
    });
}

const lines = JSON.parse(readFileSync("./src/data/lines.json"));
await Promise.all(lines.map(generateLineIcon));
