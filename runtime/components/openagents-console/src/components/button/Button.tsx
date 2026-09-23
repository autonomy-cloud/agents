import React, { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = {
  accentColor: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button: React.FC<ButtonProps> = ({
  accentColor,
  children,
  className,
  disabled,
  ...allProps
}) => {
  return (
    <button
      className={`flex flex-row items-center gap-1.5 ${
        disabled ? "pointer-events-none opacity-50" : ""
      } text-gray-950 text-sm font-medium justify-center border border-transparent bg-${accentColor}-500 px-4 py-1.5 rounded-xl transition ease-out duration-200 hover:bg-transparent hover:shadow-${accentColor} hover:border-${accentColor}-500 hover:text-${accentColor}-500 active:scale-[0.98] ${className}`}
      {...allProps}
    >
      {children}
    </button>
  );
};
