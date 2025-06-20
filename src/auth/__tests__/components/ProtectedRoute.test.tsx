import React from "react";
import { render, screen } from "@testing-library/react";
import { ProtectedRoute } from "@/auth/components/ProtectedRoute";
import { useStore } from "@/auth/store";
import { hasPermission } from "@/auth/store/actions";
import { useRouter } from "next/navigation";

// Mock the store
jest.mock("@/auth/store", () => ({
  useStore: jest.fn(),
}));

// Mock the actions
jest.mock("@/auth/store/actions", () => ({
  hasPermission: jest.fn(),
}));

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

describe("ProtectedRoute", () => {
  // Mock store state
  const mockStore = {
    user: {
      id: "1",
      name: "Test User",
      email: "test@example.com",
      role: "USER",
    },
    isLoading: false,
    isAuthenticated: true,
    isSessionExpired: jest.fn().mockReturnValue(false),
  };

  // Mock router
  const mockRouter = {
    push: jest.fn(),
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Set up mock store
    (useStore as jest.Mock).mockReturnValue(mockStore);

    // Set up mock router
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    // Set up mock actions
    (hasPermission as jest.Mock).mockReturnValue(true);
  });

  it("should render children when user is authenticated", () => {
    // Render component
    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>,
    );

    // Check that children are rendered
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();

    // Check that router.push was not called
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("should redirect to login when user is not authenticated", () => {
    // Set up mock store
    (useStore as jest.Mock).mockReturnValue({
      ...mockStore,
      isAuthenticated: false,
    });

    // Render component
    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>,
    );

    // Check that children are not rendered
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();

    // Check that router.push was called with the default redirect path
    expect(mockRouter.push).toHaveBeenCalledWith("/login");
  });

  it("should redirect to custom path when user is not authenticated", () => {
    // Set up mock store
    (useStore as jest.Mock).mockReturnValue({
      ...mockStore,
      isAuthenticated: false,
    });

    // Render component with custom redirectTo
    render(
      <ProtectedRoute redirectTo="/custom-login">
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>,
    );

    // Check that children are not rendered
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();

    // Check that router.push was called with the custom redirect path
    expect(mockRouter.push).toHaveBeenCalledWith("/custom-login");
  });

  it("should render loading component when loading", () => {
    // Set up mock store
    (useStore as jest.Mock).mockReturnValue({
      ...mockStore,
      isLoading: true,
    });

    // Render component
    render(
      <ProtectedRoute
        loadingComponent={<div data-testid="loading-content">Loading...</div>}
      >
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>,
    );

    // Check that loading component is rendered
    expect(screen.getByTestId("loading-content")).toBeInTheDocument();

    // Check that children are not rendered
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();

    // Check that router.push was not called
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("should redirect when session is expired", () => {
    // Set up mock store
    (useStore as jest.Mock).mockReturnValue({
      ...mockStore,
      isSessionExpired: jest.fn().mockReturnValue(true),
    });

    // Render component
    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>,
    );

    // Check that children are not rendered
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();

    // Check that router.push was called
    expect(mockRouter.push).toHaveBeenCalledWith("/login");
  });

  it("should check permissions when specified", () => {
    // Set up mock actions
    (hasPermission as jest.Mock).mockReturnValue(true);

    // Render component with permissions
    render(
      <ProtectedRoute permissions={["VIEW_REPORTS"]}>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>,
    );

    // Check that children are rendered
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();

    // Check that hasPermission was called with the correct permission
    expect(hasPermission).toHaveBeenCalledWith("VIEW_REPORTS");
  });

  it("should redirect when user does not have permission", () => {
    // Set up mock actions
    (hasPermission as jest.Mock).mockReturnValue(false);

    // Render component with permissions
    render(
      <ProtectedRoute permissions={["MANAGE_USERS"]}>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>,
    );

    // Check that children are not rendered
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();

    // Check that router.push was called
    expect(mockRouter.push).toHaveBeenCalledWith("/login");
  });

  it("should check all permissions when requireAll is true", () => {
    // Set up mock actions
    (hasPermission as jest.Mock).mockImplementation((permission) => {
      return permission === "VIEW_REPORTS"; // Only VIEW_REPORTS is allowed
    });

    // Render component with permissions and requireAll=true
    render(
      <ProtectedRoute
        permissions={["VIEW_REPORTS", "EDIT_REPORTS"]}
        requireAll={true}
      >
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>,
    );

    // Check that children are not rendered
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();

    // Check that router.push was called
    expect(mockRouter.push).toHaveBeenCalledWith("/login");
  });

  it("should check any permission when requireAll is false", () => {
    // Set up mock actions
    (hasPermission as jest.Mock).mockImplementation((permission) => {
      return permission === "VIEW_REPORTS"; // Only VIEW_REPORTS is allowed
    });

    // Render component with permissions and requireAll=false
    render(
      <ProtectedRoute
        permissions={["VIEW_REPORTS", "EDIT_REPORTS"]}
        requireAll={false}
      >
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>,
    );

    // Check that children are rendered
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();

    // Check that router.push was not called
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("should check user role", () => {
    // Set up mock store
    (useStore as jest.Mock).mockReturnValue({
      ...mockStore,
      user: {
        id: "1",
        name: "Admin User",
        email: "admin@example.com",
        role: "ADMIN",
      },
    });

    // Render component with roles
    render(
      <ProtectedRoute roles={["ADMIN"]}>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>,
    );

    // Check that children are rendered
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();

    // Check that router.push was not called
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("should redirect if user role does not match", () => {
    // Set up mock store
    (useStore as jest.Mock).mockReturnValue({
      ...mockStore,
      user: {
        id: "1",
        name: "Regular User",
        email: "user@example.com",
        role: "USER",
      },
    });

    // Render component with roles
    render(
      <ProtectedRoute roles={["ADMIN"]}>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>,
    );

    // Check that children are not rendered
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();

    // Check that router.push was called
    expect(mockRouter.push).toHaveBeenCalledWith("/login");
  });
});
