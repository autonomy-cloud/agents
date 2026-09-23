import { useState } from "react";

type ColorPickerProps = {
  colors: string[];
  selectedColor: string;
  onSelect: (color: string) => void;
};

export const ColorPicker = ({
  colors,
  selectedColor,
  onSelect,
}: ColorPickerProps) => {
  const [isHovering, setIsHovering] = useState(false);
  const onMouseEnter = () => {
    setIsHovering(true);
  };
  const onMouseLeave = () => {
    setIsHovering(false);
  };

  return (
    <div
      className="flex flex-row gap-1 py-2 flex-wrap"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {colors.map((color) => {
        const isSelected = color === selectedColor;
        const saturation = !isHovering && !isSelected ? "saturate-[0.25]" : "";
        const borderColor = isSelected
          ? `border-${color}-500`
          : "border-transparent";
        const opacity = isSelected ? `opacity-100` : "opacity-30";
        return (
          <div
            key={color}
            className={`${saturation} rounded-full p-1 border-2 ${borderColor} cursor-pointer hover:opacity-100 transition-all duration-200 ${opacity} hover:scale-[1.08]`}
            onClick={() => {
              onSelect(color);
            }}
          >
            <div className={`w-5 h-5 bg-${color}-500 rounded-full`}></div>
          </div>
        );
      })}
    </div>
  );
};
