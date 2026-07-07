import { NextResponse } from "next/server";

interface ScryfallImageUris {
  small?: string;
  normal?: string;
  large?: string;
}

interface ScryfallCardFace {
  name?: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  printed_name?: string;
  printed_type_line?: string;
  printed_text?: string;
  image_uris?: ScryfallImageUris;
}

interface ScryfallCard {
  object: "card";
  id: string;
  oracle_id?: string;
  name: string;
  printed_name?: string;
  lang: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  printed_type_line?: string;
  printed_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  rarity?: string;
  set_name?: string;
  collector_number?: string;
  released_at?: string;
  scryfall_uri?: string;
  gatherer_uri?: string;
  rulings_uri?: string;
  prints_search_uri?: string;
  image_uris?: ScryfallImageUris;
  card_faces?: ScryfallCardFace[];
  legalities?: Record<string, string>;
}

interface ScryfallList<T> {
  object: "list";
  data: T[];
}

interface ScryfallRuling {
  object: "ruling";
  oracle_id?: string;
  source: string;
  published_at: string;
  comment: string;
}

interface ScryfallError {
  object: "error";
  code?: string;
  status?: number;
  details?: string;
}

const SCRYFALL_HEADERS = {
  Accept: "application/json",
  "User-Agent": "TopDeck-Live Judge Console/1.0",
};

function errorMessage(data: unknown, fallback: string): string {
  const err = data as Partial<ScryfallError>;
  return typeof err.details === "string" ? err.details : fallback;
}

async function getJson<T>(
  url: string
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const res = await fetch(url, {
    headers: SCRYFALL_HEADERS,
    next: { revalidate: 60 * 60 },
  });
  const data = (await res.json().catch(() => null)) as T | ScryfallError | null;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: errorMessage(data, "Card lookup failed."),
    };
  }
  return { ok: true, data: data as T };
}

async function findCard(
  query: string
): Promise<
  { ok: true; data: ScryfallCard } | { ok: false; status: number; message: string }
> {
  const namedUrl = new URL("https://api.scryfall.com/cards/named");
  namedUrl.searchParams.set("fuzzy", query);
  const named = await getJson<ScryfallCard>(namedUrl.toString());
  if (named.ok && named.data.object === "card") return named;

  const searchUrl = new URL("https://api.scryfall.com/cards/search");
  searchUrl.searchParams.set("include_multilingual", "true");
  searchUrl.searchParams.set("unique", "prints");
  searchUrl.searchParams.set("q", query);
  const search = await getJson<ScryfallList<ScryfallCard>>(searchUrl.toString());
  if (search.ok && search.data.data.length > 0) {
    return { ok: true as const, data: search.data.data[0] };
  }

  return named.ok
    ? { ok: false, status: 404, message: "Card not found." }
    : named;
}

function firstImage(card: ScryfallCard): string | null {
  if (card.image_uris?.normal) return card.image_uris.normal;
  const face = card.card_faces?.find((item) => item.image_uris?.normal);
  return face?.image_uris?.normal ?? null;
}

function serializeCard(card: ScryfallCard, rulings: ScryfallRuling[]) {
  return {
    id: card.id,
    oracleId: card.oracle_id ?? null,
    name: card.name,
    printedName: card.printed_name ?? null,
    lang: card.lang,
    manaCost: card.mana_cost ?? null,
    typeLine: card.type_line ?? card.printed_type_line ?? null,
    oracleText: card.oracle_text ?? card.printed_text ?? null,
    power: card.power ?? null,
    toughness: card.toughness ?? null,
    loyalty: card.loyalty ?? null,
    rarity: card.rarity ?? null,
    setName: card.set_name ?? null,
    collectorNumber: card.collector_number ?? null,
    releasedAt: card.released_at ?? null,
    imageUrl: firstImage(card),
    scryfallUri: card.scryfall_uri ?? null,
    gathererUri: card.gatherer_uri ?? null,
    printsSearchUri: card.prints_search_uri ?? null,
    legalities: card.legalities ?? {},
    faces:
      card.card_faces?.map((face) => ({
        name: face.name ?? null,
        printedName: face.printed_name ?? null,
        manaCost: face.mana_cost ?? null,
        typeLine: face.type_line ?? face.printed_type_line ?? null,
        oracleText: face.oracle_text ?? face.printed_text ?? null,
      })) ?? [],
    rulings: rulings.map((ruling) => ({
      source: ruling.source,
      publishedAt: ruling.published_at,
      comment: ruling.comment,
    })),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.trim();
  if (!query) {
    return NextResponse.json(
      { error: "missing_query", detail: "Enter a card name or printed foreign name." },
      { status: 400 }
    );
  }

  const card = await findCard(query);
  if (!card.ok) {
    return NextResponse.json(
      { error: "card_not_found", detail: card.message },
      { status: card.status === 404 ? 404 : 502 }
    );
  }

  const rulings =
    card.data.rulings_uri != null
      ? await getJson<ScryfallList<ScryfallRuling>>(card.data.rulings_uri)
      : null;

  return NextResponse.json(
    {
      card: serializeCard(card.data, rulings?.ok ? rulings.data.data : []),
      rulingsAvailable: rulings?.ok ?? false,
    },
    {
      headers: {
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
