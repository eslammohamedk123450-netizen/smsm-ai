export type ProjectInput = {
  name: string;
  description?: string | null;
  color?: string;
  iconKey?: string;
};

const PROJECT_ICONS = ["folder","code","briefcase","book","lightbulb","palette","rocket","database","globe"] as const;

export function normalizeProjectInput(input: ProjectInput): {
  name: string;
  description: string | null;
  color: string;
  icon_key: string;
} {
  const name = input.name.trim();
  const description = input.description?.trim() || null;
  const color = input.color?.trim() || "#D4AF37";
  const iconKey = input.iconKey?.trim() || "folder";
  if (!name || name.length > 100) throw new Error("اسم المشروع يجب أن يكون بين حرف واحد و100 حرف.");
  if (description && description.length > 2000) throw new Error("وصف المشروع طويل جدًا.");
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error("لون المشروع غير صالح.");
  if (!(PROJECT_ICONS as readonly string[]).includes(iconKey)) throw new Error("أيقونة المشروع غير مدعومة.");
  return { name, description, color, icon_key: iconKey };
}
