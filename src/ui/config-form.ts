import { isOptionName, OPTION_NAMES, type OptionName, parseConfig } from "../app/config/card-config";
import type { MessageKey } from "../i18n/catalogs";
import { resolveLocale } from "../i18n/locale";
import { localize } from "../i18n/localize";

/**
 * The selectors the form uses, as verified at frontend 20261028.6 (`docs/research/ha-frontend.md` § 8): a subset of
 * Home Assistant's `Selector` union, written here so the card imports nothing from Home Assistant.
 */
type FormSelector =
  | { readonly text: Readonly<Record<string, never>> }
  | { readonly entity: { readonly multiple: true; readonly filter: { readonly domain: "vacuum" } } }
  | { readonly floor: { readonly multiple: true } };

/** The field Home Assistant hands back to the label and helper functions: only its name is read. */
interface ShownField {
  readonly name: string;
}

/** What `getConfigForm()` returns; Home Assistant renders `ha-form` from it and fires `config-changed` itself. */
export interface ConfigForm {
  /** One field per option (`HaFormSelector`), named after it. */
  readonly schema: readonly { readonly name: OptionName; readonly selector: FormSelector }[];
  /** Throws on a configuration the card would refuse, with the same message, which turns the visual editor off. */
  assertConfig(config: unknown): void;
  computeLabel(field: ShownField): string | undefined;
  computeHelper(field: ShownField): string | undefined;
}

const FIELDS: Readonly<
  Record<OptionName, { readonly selector: FormSelector; readonly label: MessageKey; readonly helper: MessageKey }>
> = {
  title: { selector: { text: {} }, label: "editor.title", helper: "editor.title_helper" },
  robots: {
    selector: { entity: { multiple: true, filter: { domain: "vacuum" } } },
    label: "editor.robots",
    helper: "editor.robots_helper",
  },
  floors: { selector: { floor: { multiple: true } }, label: "editor.floors", helper: "editor.floors_helper" },
};

/**
 * Home Assistant's visual editor for the card's options. The labels are the card's own, in `language()` read on each
 * call: Home Assistant passes its own `localize`, which has none of the card's strings. A field the card does not
 * know gets no label from it, so Home Assistant's default applies.
 */
export function configForm(language: () => unknown): ConfigForm {
  const words = ({ name }: ShownField, kind: "label" | "helper") =>
    isOptionName(name) ? localize(resolveLocale(language()), FIELDS[name][kind]) : undefined;
  return {
    schema: OPTION_NAMES.map((name) => ({ name, selector: FIELDS[name].selector })),
    assertConfig: parseConfig,
    computeLabel: (field) => words(field, "label"),
    computeHelper: (field) => words(field, "helper"),
  };
}
