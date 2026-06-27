Please generate a weekly schedule JSON based on the user's requirements using the following structure. Event types can be assigned custom colors from a predefined palette.

The output must be a valid JSON object with this exact schema:

```json
{
  "name": "Schedule Name",
  "description": "Brief description",
  "events": [
    {
      "title": "Activity Name",
      "type": "category_name",
      "sub": "Optional details",
      "overwriteable": false, // Optional: true if this event can be overlapped
      "timestamps": [
        {
          "day": 0, // Single day or [0, 2, 4] for Mon/Wed/Fri
          "start": "HH:MM",
          "end": "HH:MM"
        },
        {
          "day": [1, 3], // Different time on other days
          "start": "HH:MM",
          "end": "HH:MM"
        }
      ]
    }
  ],
  "color_mappings": {
    "category_name": "color-name",
    "exercise": "teal"
  }
}
```

**Structure Guidelines:**
1. **Group by Activity:** Instead of repeating "Lunch" or "Gym" entries, create a single event object for that activity.
2. **Timestamps List:** Use the `timestamps` array to define when this activity happens. Each item contains:
   - `day`: Single integer (0-6) or array of integers (e.g., `[0, 2]`)
   - `start`: Start time (HH:MM)
   - `end`: End time (HH:MM)
3. **Legacy Support:** The system still supports the flat `day`/`start`/`end` fields at the root of the event object, but the `timestamps` structure is preferred for compactness.
4. **Overwriteable Events:** If an event is marked `"overwriteable": true`, it acts as a "background" activity (like "Study Day" or "Available"). Higher-priority, non-overwriteable events that overlap with it will "cut into" it visually and in statistics, essentially taking precedence over that time slot.

- Use broad, general categories for the `type` field to keep the schedule readable.
- Avoid creating too many unique categories (e.g., use "exercise" instead of separate "running" and "lifting" types).
- Examples: "work", "class", "exercise", "food", "commute", "social", "other".
- You may use other category names if they better fit the user's specific routine, provided they remain high-level.

**Color Mapping Guidelines:**
- Only include `color_mappings` if the user specifies color preferences or if you want to ensure a specific visual grouping.
- Use one of the 16 valid color names: `yellow-orange`, `yellow`, `orange`, `red`, `blue`, `purple`, `teal`, `light-purple`, `light-blue`, `green`, `black`, `muted-gray`, `brown`, `light-pink`, `kiwi`, `rose`.
- Map each unique `type` used in the `events` array to a color name in the `color_mappings` object.

Ensure all time slots are contiguous where applicable and the JSON is valid.
