import { z } from "zod";

/**
 * ISO-8601-Zeitstempel an API-Grenzen. PostgreSQL/PostgREST liefert UTC
 * üblicherweise als `+00:00`, während Browser oft die gleichwertige
 * `Z`-Schreibweise erzeugen.
 */
export const isoDateTimeSchema = z.string().datetime({ offset: true });
