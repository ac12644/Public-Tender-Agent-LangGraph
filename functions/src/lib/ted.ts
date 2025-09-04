type TedSearchResponse = {
  notices?: any[];
  totalNoticeCount?: number;
  iterationNextToken?: string | null;
  timedOut?: boolean;
  errors?: any;
};

const TED_URL = "https://api.ted.europa.eu/v3/notices/search";
const DEFAULT_FIELDS = [
  "publication-number",
  "notice-identifier",
  "notice-title",
  "buyer-name",
  "publication-date",
  "deadline-date-lot",
  "classification-cpv",
  "estimated-value-glo",
  "estimated-value-cur-glo",
  "total-value",
  "links",
  "description-proc",
];

async function fetchJson(input: string | URL, init: RequestInit) {
  const res = await fetch(input, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    // keep raw text for debugging
    json = { parseError: String(e), raw: text };
  }
  if (!res.ok) {
    throw new Error(
      `TED API ${res.status} ${res.statusText}: ${
        json?.message || json?.error || text
      }`
    );
  }
  return json;
}

/**
 * Robust TED v3 search using Expert Query.
 * Accepts { q, limit } and sends both "q" and "query" to be compatible with
 * older/newer docs/implementations.
 */
export async function tedSearch({
  q,
  limit = 10,
}: {
  q: string;
  limit?: number;
}) {
  const body = {
    query: q,
    paginationMode: "PAGE_NUMBER",
    page: 1,
    limit,
    onlyLatestVersions: true,
    fields: DEFAULT_FIELDS,
  };

  const json = (await fetchJson(TED_URL, {
    method: "POST",
    body: JSON.stringify(body),
  })) as TedSearchResponse;

  if (json?.notices?.length) {
    console.log(
      "🔎 TED API raw notice[0]:",
      JSON.stringify(json.notices[0], null, 2)
    );
    if (json.notices[1]) {
      console.log(
        "🔎 TED API raw notice[1]:",
        JSON.stringify(json.notices[1], null, 2)
      );
    }
  } else {
    console.log("⚠️ TED API returned no notices for query:", q);
  }

  // Occasionally the API returns nothing due to strict dates.
  // We'll just return an array (possibly empty) and let caller decide fallbacks.
  return Array.isArray(json.notices) ? (json.notices as any[]) : [];
}

export async function tedFetchXML(publicationNumber: string) {
  const url = `https://ted.europa.eu/en/notice/${encodeURIComponent(
    publicationNumber
  )}/xml`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch XML ${publicationNumber}`);
  return await res.text();
}
