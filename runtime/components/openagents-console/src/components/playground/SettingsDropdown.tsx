import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CheckIcon, ChevronIcon, MoonIcon, SunIcon } from "./icons";
import { useConfig } from "@/hooks/useConfig";
import { useTheme } from "@/hooks/useTheme";

type SettingType = "inputs" | "outputs" | "chat" | "theme_color";

type SettingValue = {
  title: string;
  type: SettingType | "separator";
  key: string;
};

const settingsDropdown: SettingValue[] = [
  {
    title: "Show chat",
    type: "chat",
    key: "N/A",
  },
  {
    title: "---",
    type: "separator",
    key: "separator_1",
  },
  {
    title: "Show video",
    type: "outputs",
    key: "video",
  },
  {
    title: "Show audio",
    type: "outputs",
    key: "audio",
  },

  {
    title: "---",
    type: "separator",
    key: "separator_2",
  },
  {
    title: "Enable camera",
    type: "inputs",
    key: "camera",
  },
  {
    title: "Enable mic",
    type: "inputs",
    key: "mic",
  },
  {
    title: "Allow screenshare",
    type: "inputs",
    key: "screen",
  },
];

export const SettingsDropdown = () => {
  const { config, setUserSettings } = useConfig();
  const { theme, toggleTheme } = useTheme();

  const isEnabled = (setting: SettingValue) => {
    if (setting.type === "separator" || setting.type === "theme_color")
      return false;
    if (setting.type === "chat") {
      return config.settings[setting.type];
    }

    if (setting.type === "inputs") {
      const key = setting.key as "camera" | "mic" | "screen";
      return config.settings.inputs[key];
    } else if (setting.type === "outputs") {
      const key = setting.key as "video" | "audio";
      return config.settings.outputs[key];
    }

    return false;
  };

  const toggleSetting = (setting: SettingValue) => {
    if (setting.type === "separator" || setting.type === "theme_color") return;
    const newValue = !isEnabled(setting);
    const newSettings = { ...config.settings };

    if (setting.type === "chat") {
      newSettings.chat = newValue;
    } else if (setting.type === "inputs") {
      newSettings.inputs[setting.key as "camera" | "mic" | "screen"] = newValue;
    } else if (setting.type === "outputs") {
      newSettings.outputs[setting.key as "video" | "audio"] = newValue;
    }
    setUserSettings(newSettings);
  };

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger className="group inline-flex max-h-12 items-center gap-1.5 rounded-xl hover:bg-gray-200 dark:hover:bg-surface-3 bg-gray-100 dark:bg-surface-2 border border-gray-200 dark:border-white/10 px-3 py-1.5 text-gray-700 dark:text-gray-200 my-auto text-sm font-medium h-full transition-colors">
        Settings
        <ChevronIcon />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 flex w-60 flex-col gap-0.5 overflow-hidden rounded-xl text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-1 shadow-elevated p-1.5 text-sm"
          sideOffset={8}
          collisionPadding={16}
        >
          {settingsDropdown.map((setting) => {
            if (setting.type === "separator") {
              return (
                <div
                  key={setting.key}
                  className="border-t border-gray-200 dark:border-white/[0.06] my-1.5"
                />
              );
            }

            return (
              <DropdownMenu.Label
                key={setting.key}
                onClick={() => toggleSetting(setting)}
                className="flex max-w-full flex-row items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-surface-3 hover:text-gray-900 dark:hover:text-white cursor-pointer transition-colors"
              >
                <div className="w-4 h-4 flex items-center justify-center shrink-0 text-gray-900 dark:text-white">
                  {isEnabled(setting) && <CheckIcon />}
                </div>
                <span>{setting.title}</span>
              </DropdownMenu.Label>
            );
          })}
          <div className="border-t border-gray-200 dark:border-white/[0.06] my-1.5" />
          <DropdownMenu.Label
            onClick={toggleTheme}
            className="flex max-w-full flex-row items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-surface-3 hover:text-gray-900 dark:hover:text-white cursor-pointer transition-colors"
          >
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              {theme === "dark" ? <MoonIcon /> : <SunIcon />}
            </div>
            <span>{theme === "dark" ? "Dark theme" : "Light theme"}</span>
          </DropdownMenu.Label>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
