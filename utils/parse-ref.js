const fs = require("fs");

// https://data.iledefrance-mobilites.fr/explore/dataset/referentiel-des-lignes/information/

// Configuration
const inputFile = process.argv[2] || "referentiel-des-lignes.json";
const outputFile = "src/data/lines.json";

function render_line_name(line) {
  switch (line.transportmode) {
    case "bus":
      return `Bus ${line.name_line}`;

    case "metro":
      return `Metro ${line.name_line.replace("B", " Bis")}`;

    case "rail":
      if (line.networkname) {
        return `${line.networkname} ${line.name_line}`;
      } else {
        return `Train ${line.name_line}`;
      }

    case "tram":
      return `Tramway ${line.name_line}`;

    case "cableway":
      return `Cableway ${line.name_line}`;

    default:
      console.warn(
        `Unknown transport mode: ${line.transportmode} for line ${line.name_line}`,
      );
      return line.name_line;
  }
}

try {
  const rawData = fs.readFileSync(inputFile, "utf8");
  const jsonData = JSON.parse(rawData);

  const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
  const totalRecords = dataArray.length;
  console.log(`Total records in input: ${totalRecords}`);

  const processedData = dataArray
    .filter((item) => {
      // Rule: valid_todate must be null
      if (item.valid_todate !== null) return false;

      // Rule: name_line or networkname must NOT include "TER"
      const containsTER = (str) => str && str.includes("TER");
      if (containsTER(item.name_line) || containsTER(item.networkname))
        return false;

      // Rule: name_line must equal shortname_line
      if (item.name_line !== item.shortname_line) return false;

      // Rule: transportsubmode must NOT be "demandAndResponseBus"
      if (item.transportsubmode === "demandAndResponseBus") return false;

      return true;
    })
    .map((item) => {
      return {
        id_line: item.id_line,
        name_line: render_line_name(item),
        transportmode: item.transportmode,
        transportsubmode: item.transportsubmode,
        networkname: item.networkname,
        colourweb_hexa: item.colourweb_hexa,
        textcolourweb_hexa: item.textcolourweb_hexa,
        picto: item.picto,
        shortname_groupoflines: item.shortname_groupoflines,
      };
    });

  fs.writeFileSync(outputFile, JSON.stringify(processedData), "utf8");

  console.log(
    `Success! Processed ${processedData.length} records. Saved to ${outputFile}`,
  );
} catch (error) {
  console.error("An error occurred:", error.message);
}
