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
  | {
      readonly entity: {
        readonly multiple: true;
        readonly filter: readonly { readonly domain: "vacuum"; readonly integration: string }[];
      };
    }
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

const WORDS: Readonly<Record<OptionName, { readonly label: MessageKey; readonly helper: MessageKey }>> = {
  title: { label: "editor.title", helper: "editor.title_helper" },
  robots: { label: "editor.robots", helper: "editor.robots_helper" },
  floors: { label: "editor.floors", helper: "editor.floors_helper" },
};

/**
 * Each option's selector. The robot picker offers only the vacuums of `platforms`, the supported integrations: Home
 * Assistant matches `integration` against the entity registry `platform` (`docs/research/ha-frontend.md` § 8).
 */
function selectors(platforms: readonly string[]): Readonly<Record<OptionName, FormSelector>> {
  return {
    title: { text: {} },
    robots: {
      entity: { multiple: true, filter: platforms.map((integration) => ({ domain: "vacuum", integration })) },
    },
    floors: { floor: { multiple: true } },
  };
}

/**
 * Home Assistant's visual editor for the card's options, offering the robots of `platforms`. The labels are the card's
 * own, in `language()` read on each call: Home Assistant passes its own `localize`, which has none of the card's
 * strings. A field the card does not know gets no label from it, so Home Assistant's default applies.
 */
export function configForm(platforms: readonly string[], language: () => unknown): ConfigForm {
  const words = ({ name }: ShownField, kind: "label" | "helper") =>
    isOptionName(name) ? localize(resolveLocale(language()), WORDS[name][kind]) : undefined;
  const selector = selectors(platforms);
  return {
    schema: OPTION_NAMES.map((name) => ({ name, selector: selector[name] })),
    assertConfig: parseConfig,
    computeLabel: (field) => words(field, "label"),
    computeHelper: (field) => words(field, "helper"),
  };
}
