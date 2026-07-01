// Types for the IMDbSpy app. Mirror the shapes documented in docs/api.md under
// "IMDbSpy" and the MediaItem/RatingWeights serialization in the backend.

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type MediaStatus = "seen" | "not_seen" | "abandoned";
export type ScaleType = "fun" | "grit" | "comfort";

export interface PersonRef {
  name: string;
  id: string | null;
}

export interface MediaItem {
  id: number;
  imdb_id: string;
  title: string;
  description: string | null;
  kind: string;
  genres: string[] | null;
  rating: number | null;
  rating_count: number | null;
  creators: PersonRef[] | null;
  seasons: number | null;
  seasons_seen: number | null;
  episodes: number | null;
  years: string | null;
  directors: PersonRef[] | null;
  writers: PersonRef[] | null;
  runtime_minutes: number | null;
  cast: PersonRef[] | null;
  title_image_path: string | null;
  actor_image_paths: Record<string, string> | null;
  status: MediaStatus;
  user_rating: number | null;
  user_review: string | null;
  scale_type: ScaleType | null;
  entertaining_rating: number | null;
  momentum_rating: number | null;
  characters_rating: number | null;
  rewatchability_rating: number | null;
  immersive_rating: number | null;
  stakes_rating: number | null;
  heart_rating: number | null;
  added_at: string | null;
}

export interface MediaListResult {
  items: MediaItem[];
  total: number;
  has_more: boolean;
}

export interface AddMediaError {
  url: string;
  code: string;
  message: string;
}

export interface AddMediaResult {
  added: MediaItem[];
  errors: AddMediaError[];
}

export interface RatingWeights {
  id: number;
  scale_type: ScaleType;
  entertaining_weight: number;
  momentum_weight: number;
  characters_weight: number;
  rewatchability_weight: number;
  immersive_weight: number;
  stakes_weight: number;
  heart_weight: number;
}

export interface RefreshResult {
  updated_count: number;
  updated: Array<{ imdb_id: string; title: string }>;
  errors: Array<{ imdb_id: string; error: string }>;
}

export type KindFilter = "movie" | "tv";

export interface ListParams {
  status?: MediaStatus;
  kind?: KindFilter;
  search?: string;
  limit?: number;
  offset?: number;
}

/** Per-criterion 0-5 ratings + review + seasons for the review endpoint. */
export interface ReviewInput {
  scale_type?: ScaleType;
  entertaining_rating?: number;
  momentum_rating?: number;
  characters_rating?: number;
  rewatchability_rating?: number;
  immersive_rating?: number;
  stakes_rating?: number;
  heart_rating?: number;
  user_review?: string;
  seasons_seen?: number;
}

/** The four active criteria (bare names) for each weighted scale. */
export const SCALE_CRITERIA: Record<ScaleType, string[]> = {
  fun: ["entertaining", "momentum", "characters", "rewatchability"],
  grit: ["immersive", "stakes", "characters", "rewatchability"],
  comfort: ["entertaining", "heart", "characters", "rewatchability"],
};
