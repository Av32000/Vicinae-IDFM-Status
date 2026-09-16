import {
  Action,
  ActionPanel,
  getPreferenceValues,
  Icon,
  List,
  LocalStorage,
  showToast,
  Toast,
} from "@vicinae/api";
import { useEffect, useMemo, useState } from "react";
import linesData from "./data/lines.json";

type Line = {
  id_line: string;
  name_line: string;
  transportmode: string;
  transportsubmode: string | null;
  networkname: string;
  colourweb_hexa: string;
  textcolourweb_hexa: string;
  picto: { url: string } | null;
  shortname_groupoflines: string;
};

type TraficInfoType = "Disrupted" | "Information" | "Interrupted";

type TraficInfo = {
  title: string;
  content: string;
  start: Date;
  end: Date;
  type: TraficInfoType;
  effect: string;
  color: string;
  updated_at: Date;
};

function parseDate(str: string) {
  const formatted = str.replace(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/,
    "$1-$2-$3T$4:$5:$6",
  );
  return new Date(formatted);
}

const allLines = linesData as Line[];
const linesById = new Map<string, Line>();
const linesByMode: Record<string, Line[]> = {
  rail: [],
  metro: [],
  bus: [],
  tram: [],
  cableway: [],
};

allLines
  .sort((a, b) => {
    const nameAStr = a?.name_line || "";
    const nameBStr = b?.name_line || "";

    const nameA = nameAStr.split(" ")[1] || nameAStr;
    const nameB = nameBStr.split(" ")[1] || nameBStr;

    const numA = parseInt(nameA, 10);
    const numB = parseInt(nameB, 10);

    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }

    return nameA.localeCompare(nameB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  })
  .forEach((line) => {
    linesById.set(line.id_line, line);

    const mode = line.transportmode.toLowerCase();
    if (!linesByMode[mode]) {
      linesByMode[mode] = [];
    }
    linesByMode[mode].push(line);
  });

function htmlToNewlines(str: string) {
  if (!str) return "";
  return str
    .replace(/<\s*\/?\s*p\s*>/gi, "\n")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .trim();
}

function generateMarkdown(info: TraficInfo) {
  return `# ${info.title}\n${htmlToNewlines(info.content)}`;
}

const LineInfoView = ({ line }: { line: Line }) => {
  const [traficInfo, setTraficInfo] = useState<TraficInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const abortController = new AbortController();
    setLoading(true);

    fetch(
      `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/line_reports/lines/line:IDFM:${line.id_line}/line_reports?language=en-US`,
      {
        headers: {
          accept: "application/json",
          apiKey: getPreferenceValues()["idfm-api-token"],
        },
        signal: abortController.signal,
      },
    )
      .then((response) => response.json())
      .then((data) => {
        const traffic: TraficInfo[] = data.disruptions
          .filter((disruption: any) => {
            return (
              disruption.status === "active" &&
              ((disruption.tags || []).length === 0 ||
                disruption.tags[0] !== "Ascenseur")
            );
          })
          .map((disruption: any) => {
            let severity: TraficInfoType = "Information";
            switch (disruption.severity.name) {
              case "perturbée":
                severity = "Disrupted";
                break;
              case "bloquée":
              default:
                severity = "Interrupted";
                break;
            }
            return {
              title:
                disruption.messages.find((m: any) => m.channel.name === "titre")
                  ?.text || "",
              content:
                disruption.messages.find(
                  (m: any) => m.channel.name === "moteur",
                )?.text || "",
              start: parseDate(disruption.publication_period.begin),
              end: parseDate(disruption.publication_period.end),
              type: severity,
              effect: disruption.severity.effect,
              color: disruption.severity.color,
              updated_at: parseDate(disruption.updated_at),
            };
          });
        setTraficInfo(traffic);
        setLoading(false);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Failed to fetch traffic info:", error);
          showToast({
            title: "Error",
            message: "Failed to fetch traffic data",
            style: Toast.Style.Failure,
          });
          setLoading(false);
        }
      });

    return () => abortController.abort();
  }, [line.id_line]);

  return (
    <List
      isLoading={loading}
      searchBarPlaceholder={"Search disruptions..."}
      isShowingDetail={traficInfo.length > 0}
    >
      {traficInfo.map((info) => (
        <List.Item
          key={info.title}
          title={info.title}
          icon={line.id_line + ".png"}
          detail={
            <List.Item.Detail
              markdown={generateMarkdown(info)}
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.Label
                    title="Period"
                    text={`${info.start.toLocaleString()} - ${info.end.toLocaleString()}`}
                  />
                  <List.Item.Detail.Metadata.Label
                    title="Effect"
                    text={info.effect}
                  />
                  <List.Item.Detail.Metadata.Separator />
                  <List.Item.Detail.Metadata.Label
                    title="Last update"
                    text={info.updated_at.toLocaleString()}
                  />
                </List.Item.Detail.Metadata>
              }
            />
          }
        />
      ))}
      <List.EmptyView
        icon={Icon.CheckCircle}
        title={"All Good !"}
        description={"No disruptions found for this line."}
      />
    </List>
  );
};

export default function IDFMInfoTrafic() {
  const [favoriteLines, setFavoriteLines] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const rawFavorites =
          await LocalStorage.getItem<string>("favoriteLines");
        if (rawFavorites) {
          const parsedFavorites = JSON.parse(rawFavorites);
          setFavoriteLines(
            Array.isArray(parsedFavorites) ? parsedFavorites : [],
          );
        }
      } catch {
        setFavoriteLines([]);
      } finally {
        setIsLoading(false);
      }
    };
    void loadFavorites();
  }, []);

  const toggleFavorite = async (line: Line) => {
    const isFavorite = favoriteLines.includes(line.id_line);
    const updatedFavorites = isFavorite
      ? favoriteLines.filter((id) => id !== line.id_line)
      : [...favoriteLines, line.id_line];

    setFavoriteLines(updatedFavorites);
    await LocalStorage.setItem(
      "favoriteLines",
      JSON.stringify(updatedFavorites),
    );

    showToast({
      title: isFavorite
        ? `${line.name_line} removed from favorites`
        : `${line.name_line} added to favorites`,
    });
  };

  const favoriteLinesData = useMemo(() => {
    return favoriteLines
      .map((id) => linesById.get(id))
      .filter(Boolean) as Line[];
  }, [favoriteLines]);

  const renderSection = (
    title: string,
    linesToRender: Line[],
    isFavSection = false,
  ) => {
    if (!isFavSection && linesToRender.length === 0) return null;

    return (
      <List.Section
        title={title.charAt(0).toUpperCase() + title.slice(1)}
        key={title}
      >
        {linesToRender.map((line) => {
          const isFavorite = favoriteLines.includes(line.id_line);
          if (!isFavSection && isFavorite) return null;

          const safeKeywords = [
            line.name_line,
            line.networkname,
            line.shortname_groupoflines,
            line.transportmode,
          ].filter(
            (k) => typeof k === "string" && k.trim().length > 0,
          ) as string[];

          return (
            <List.Item
              key={line.id_line}
              title={line.name_line}
              icon={line.id_line + ".png"}
              keywords={safeKeywords}
              actions={
                <ActionPanel>
                  <Action.Push
                    title={"Show trafic info"}
                    target={<LineInfoView line={line} />}
                    icon={line.id_line + ".png"}
                  />
                  <Action
                    title={
                      isFavorite ? "Remove from favorites" : "Add to favorites"
                    }
                    icon={isFavorite ? Icon.StarDisabled : Icon.Star}
                    onAction={async () => {
                      await toggleFavorite(line);
                    }}
                  />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    );
  };

  return (
    <List isLoading={isLoading}>
      {renderSection("favorites", favoriteLinesData, true)}
      {renderSection("rail", linesByMode["rail"] || [])}
      {renderSection("metro", linesByMode["metro"] || [])}
      {renderSection("bus", linesByMode["bus"] || [])}
      {renderSection("tram", linesByMode["tram"] || [])}
      {renderSection("cableway", linesByMode["cableway"] || [])}
    </List>
  );
}
