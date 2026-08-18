import { Navigate, useLocation } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
  const location = useLocation();

  const user = localStorage.getItem("wildguard_user");
  const token = localStorage.getItem("wildguard_token");

  /*
   * User is authenticated only when both
   * the user object and authentication token exist.
   */

  if (!user || !token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
          message:
            "Please sign in to access the WildGuard dashboard.",
        }}
      />
    );
  }

  /*
   * Verify that the stored user data is valid JSON.
   */

  try {
    const parsedUser = JSON.parse(user);

    if (!parsedUser?.id || !parsedUser?.email) {
      localStorage.removeItem("wildguard_user");
      localStorage.removeItem("wildguard_token");

      return (
        <Navigate
          to="/login"
          replace
          state={{
            from: location.pathname,
            message:
              "Your session is invalid. Please sign in again.",
          }}
        />
      );
    }

    /*
     * Account must be active.
     */

    if (parsedUser.isActive === false) {
      localStorage.removeItem("wildguard_user");
      localStorage.removeItem("wildguard_token");

      return (
        <Navigate
          to="/login"
          replace
          state={{
            message:
              "Your account is currently inactive.",
          }}
        />
      );
    }

    return children;
  } catch (error) {
    console.error(
      "Invalid WildGuard session:",
      error
    );

    localStorage.removeItem("wildguard_user");
    localStorage.removeItem("wildguard_token");

    return (
      <Navigate
        to="/login"
        replace
        state={{
          message:
            "Your session has expired. Please sign in again.",
        }}
      />
    );
  }
};

export default ProtectedRoute;