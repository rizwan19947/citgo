import type { DotCMSNavigationItem } from "@dotcms/types";

/*
 * Site header component. Receives the nav items fetched from DotCMS and
 * optionally a logo image URL/alt text. Currently a placeholder — add your
 * navigation markup here (links, dropdowns, mobile menu, etc.).
 */

interface HeaderProps {
  navItems: DotCMSNavigationItem[];
  logo?: string;
  logoAlt?: string;
}

export default function Header({
  navItems,
  logo,
  logoAlt = "Logo",
}: HeaderProps) {
  return (
    <header className="flex justify-center items-center bg-gray-400 mb-2">
      <p>Header</p>
    </header>
  );
}
