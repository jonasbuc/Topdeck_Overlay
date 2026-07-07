import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    rules: {
      "import/no-anonymous-default-export": "off",
      "react/no-inline-styles": "off",
      "jsx-a11y/aria-proptypes": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default config;
