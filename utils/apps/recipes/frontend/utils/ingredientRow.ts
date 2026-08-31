/** The editor's in-progress ingredient shape: all strings, so a half-typed
 *  quantity is representable. `submit` narrows it to the API payload. */
export interface IngRow {
  name: string;
  quantity: string;
  unit: string;
  is_optional: boolean;
  category: string;
}

export const EMPTY_ING: IngRow = {
  name: "",
  quantity: "",
  unit: "",
  is_optional: false,
  category: "Other",
};

export const CATEGORIES = [
  "Produce",
  "Dairy & Eggs",
  "Pantry / Dry Goods",
  "Canned / Jarred",
  "Proteins",
  "Spices & Baking",
  "Other",
];
