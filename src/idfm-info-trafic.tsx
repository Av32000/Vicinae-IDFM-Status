import {
  Action,
  ActionPanel,
  getPreferenceValues,
  Icon,
  List,
  LocalStorage,
  showToast,
} from "@vicinae/api";
import { useEffect, useState } from "react";
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

function getTraficInfoForLine(
  line: Line,
  setTraficInfo: (traficInfo: TraficInfo[]) => void,
  setLoading: (loading: boolean) => void,
) {
  setLoading(true);
  fetch(
    `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/line_reports/lines/line:IDFM:${line.id_line}/line_reports?language=en-US`,
    {
      headers: {
        accept: "application/json",
        apiKey: getPreferenceValues()["idfm-api-token"],
      },
    },
  )
    .then((response) => response.json())
    .then((data) => {
      const traficInfo: TraficInfo[] = data.disruptions
        .filter((disruption: any) => {
          return (
            disruption.status == "active" &&
            ((disruption.tags || []).length == 0 ||
              disruption.tags[0] != "Ascenseur")
          );
        })
        .map((disruption: any) => {
          let severity: TraficInfoType = "Information";
          switch (disruption.severity.name) {
            case "perturbée":
              severity = "Disrupted";
              break;
            case "bloquée":
              severity = "Interrupted";
              break;
            default:
              severity = "Interrupted";
              break;
          }
          return {
            title:
              disruption.messages.find(
                (message: any) => message.channel.name === "titre",
              )?.text || "",
            content:
              disruption.messages.find(
                (message: any) => message.channel.name === "moteur",
              )?.text || "",
            start: parseDate(disruption.publication_period.begin),
            end: parseDate(disruption.publication_period.end),
            type: severity,
            effect: disruption.severity.effect,
            color: disruption.severity.color,
            updated_at: parseDate(disruption.updated_at),
          };
        });
      setTraficInfo(traficInfo);
      setLoading(false);
    });
}

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

const lines = linesData as Line[];

const LineInfoView = ({ line }: { line: Line }) => {
  const [traficInfo, setTraficInfo] = useState<TraficInfo[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getTraficInfoForLine(line, setTraficInfo, setLoading);
  }, []);
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

function lineSectionContent(
  transportmode: string,
  favoriteLines: string[],
  onToggleFavorite: (line: Line) => Promise<void>,
) {
  let sectionTitle = transportmode;
  sectionTitle = sectionTitle[0].toLocaleUpperCase() + sectionTitle.slice(1);

  return (
    <List.Section title={sectionTitle} key={transportmode}>
      {lines
        .filter((line) =>
          transportmode === "favorites"
            ? favoriteLines.includes(line.id_line)
            : line.transportmode === transportmode &&
              !favoriteLines.includes(line.id_line),
        )
        .sort((a, b) => {
          let nameA = a.name_line.split(" ")[1];
          let nameB = b.name_line.split(" ")[1];

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
        .map((line) => {
          const isFavorite = favoriteLines.includes(line.id_line);

          return (
            <List.Item
              key={line.id_line}
              title={line.name_line}
              icon={line.id_line + ".png"}
              keywords={[
                line.name_line,
                line.networkname,
                line.shortname_groupoflines,
                line.transportmode,
              ]}
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
                      await onToggleFavorite(line);
                    }}
                  />
                </ActionPanel>
              }
            />
          );
        })}
    </List.Section>
  );
}

export default function IDFMInfoTrafic() {
  const [favoriteLines, setFavoriteLines] = useState<string[]>([]);

  useEffect(() => {
    const loadFavorites = async () => {
      const rawFavorites = await LocalStorage.getItem<string>("favoriteLines");

      if (!rawFavorites) {
        setFavoriteLines([]);
        return;
      }

      try {
        const parsedFavorites = JSON.parse(rawFavorites);
        setFavoriteLines(Array.isArray(parsedFavorites) ? parsedFavorites : []);
      } catch {
        setFavoriteLines([]);
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

  return (
    <List>
      {["favorites", "rail", "metro", "bus", "tram", "cableway"].map(
        (transportmode) =>
          lineSectionContent(transportmode, favoriteLines, toggleFavorite),
      )}
    </List>
  );
}
