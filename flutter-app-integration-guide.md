# Flutter Application Integration Guide for LC Reports API

This guide provides instructions for building a Flutter application that connects to the LC Reports Python API. It covers authentication, data fetching, real-time updates, and UI components.

## Table of Contents

1. [Project Setup](#project-setup)
2. [Authentication Implementation](#authentication-implementation)
3. [API Service Layer](#api-service-layer)
4. [State Management](#state-management)
5. [Dashboard Implementation](#dashboard-implementation)
6. [Report Management](#report-management)
7. [Real-time Updates](#real-time-updates)
8. [Notifications](#notifications)
9. [Offline Support](#offline-support)
10. [Testing](#testing)

## Project Setup

### Dependencies

Add the following dependencies to your `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^1.1.0
  flutter_secure_storage: ^9.0.0
  provider: ^6.0.5
  flutter_riverpod: ^2.4.0
  go_router: ^12.0.0
  json_annotation: ^4.8.1
  freezed_annotation: ^2.4.1
  dio: ^5.3.3
  shared_preferences: ^2.2.1
  flutter_local_notifications: ^16.0.0
  connectivity_plus: ^5.0.1
  web_socket_channel: ^2.4.0
  intl: ^0.18.1
  flutter_dotenv: ^5.1.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  build_runner: ^2.4.6
  json_serializable: ^6.7.1
  freezed: ^2.4.5
  mockito: ^5.4.2
```

### Environment Configuration

Create a `.env` file in the root of your project:

```
API_BASE_URL=http://your-api-url:8000/api/v1
WS_BASE_URL=ws://your-api-url:8000/ws
```

Load environment variables in your app:

```dart
import 'package:flutter_dotenv/flutter_dotenv.dart';

Future<void> main() async {
  await dotenv.load();
  runApp(MyApp());
}
```

## Authentication Implementation

### Models

Create models for authentication:

```dart
// lib/models/auth/user.dart
import 'package:json_annotation/json_annotation.dart';

part 'user.g.dart';

@JsonSerializable()
class User {
  final String id;
  final String email;
  final String name;
  final String username;
  final String role;
  final String? branchId;
  final String? image;
  final DateTime? lastLogin;

  User({
    required this.id,
    required this.email,
    required this.name,
    required this.username,
    required this.role,
    this.branchId,
    this.image,
    this.lastLogin,
  });

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
  Map<String, dynamic> toJson() => _$UserToJson(this);
}

// lib/models/auth/token.dart
import 'package:json_annotation/json_annotation.dart';

part 'token.g.dart';

@JsonSerializable()
class Token {
  final String accessToken;
  final String tokenType;
  final String? refreshToken;
  final DateTime? expiresAt;

  Token({
    required this.accessToken,
    required this.tokenType,
    this.refreshToken,
    this.expiresAt,
  });

  factory Token.fromJson(Map<String, dynamic> json) => _$TokenFromJson(json);
  Map<String, dynamic> toJson() => _$TokenToJson(this);
}
```

### Authentication Service

```dart
// lib/services/auth_service.dart
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/auth/token.dart';
import '../models/auth/user.dart';

class AuthService {
  final Dio _dio = Dio();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final String _baseUrl = dotenv.env['API_BASE_URL'] ?? '';

  // Login with username and password
  Future<Token> login(String username, String password) async {
    try {
      final response = await _dio.post(
        '$_baseUrl/auth/login/json',
        data: {
          'username': username,
          'password': password,
        },
      );

      final token = Token.fromJson(response.data);

      // Store tokens securely
      await _storage.write(key: 'access_token', value: token.accessToken);
      if (token.refreshToken != null) {
        await _storage.write(key: 'refresh_token', value: token.refreshToken);
      }

      return token;
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        throw Exception('Invalid credentials');
      } else if (e.response?.statusCode == 429) {
        throw Exception('Too many login attempts. Please try again later.');
      }
      throw Exception('Login failed: ${e.message}');
    }
  }

  // Get current user profile
  Future<User> getCurrentUser() async {
    try {
      final token = await _storage.read(key: 'access_token');
      if (token == null) {
        throw Exception('Not authenticated');
      }

      final response = await _dio.get(
        '$_baseUrl/auth/me',
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
          },
        ),
      );

      return User.fromJson(response.data);
    } catch (e) {
      throw Exception('Failed to get user profile: $e');
    }
  }

  // Refresh token
  Future<Token> refreshToken() async {
    try {
      final refreshToken = await _storage.read(key: 'refresh_token');
      if (refreshToken == null) {
        throw Exception('No refresh token available');
      }

      final response = await _dio.post(
        '$_baseUrl/auth/refresh',
        data: {
          'refresh_token': refreshToken,
        },
      );

      final token = Token.fromJson(response.data);

      // Update stored tokens
      await _storage.write(key: 'access_token', value: token.accessToken);
      if (token.refreshToken != null) {
        await _storage.write(key: 'refresh_token', value: token.refreshToken);
      }

      return token;
    } catch (e) {
      throw Exception('Failed to refresh token: $e');
    }
  }

  // Logout
  Future<void> logout() async {
    try {
      await _storage.delete(key: 'access_token');
      await _storage.delete(key: 'refresh_token');
    } catch (e) {
      throw Exception('Failed to logout: $e');
    }
  }

  // Check if user is authenticated
  Future<bool> isAuthenticated() async {
    final token = await _storage.read(key: 'access_token');
    return token != null;
  }
}
```

### Authentication Provider

```dart
// lib/providers/auth_provider.dart
import 'package:flutter/foundation.dart';
import '../models/auth/user.dart';
import '../services/auth_service.dart';

class AuthProvider with ChangeNotifier {
  final AuthService _authService = AuthService();

  User? _user;
  bool _isLoading = false;
  String? _error;

  User? get user => _user;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => _user != null;

  Future<bool> login(String username, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _authService.login(username, password);
      _user = await _authService.getCurrentUser();
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _isLoading = false;
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    try {
      await _authService.logout();
      _user = null;
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      _error = e.toString();
      notifyListeners();
    }
  }

  Future<bool> checkAuthStatus() async {
    _isLoading = true;
    notifyListeners();

    try {
      final isAuth = await _authService.isAuthenticated();
      if (isAuth) {
        _user = await _authService.getCurrentUser();
      }
      _isLoading = false;
      notifyListeners();
      return isAuth;
    } catch (e) {
      _isLoading = false;
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }
}
```

## API Service Layer

Create a base API service to handle common functionality:

```dart
// lib/services/api_service.dart
import 'package:dio/dio.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiService {
  final Dio _dio = Dio();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final String _baseUrl = dotenv.env['API_BASE_URL'] ?? '';

  ApiService() {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Add auth token to all requests
          final token = await _storage.read(key: 'access_token');
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          // Handle 401 errors (token expired)
          if (error.response?.statusCode == 401) {
            try {
              // Try to refresh the token
              final refreshToken = await _storage.read(key: 'refresh_token');
              if (refreshToken != null) {
                final response = await Dio().post(
                  '$_baseUrl/auth/refresh',
                  data: {'refresh_token': refreshToken},
                );

                // Store new tokens
                await _storage.write(key: 'access_token', value: response.data['access_token']);
                if (response.data['refresh_token'] != null) {
                  await _storage.write(key: 'refresh_token', value: response.data['refresh_token']);
                }

                // Retry the original request
                final opts = error.requestOptions;
                opts.headers['Authorization'] = 'Bearer ${response.data['access_token']}';
                final retryResponse = await _dio.fetch(opts);
                return handler.resolve(retryResponse);
              }
            } catch (e) {
              // If refresh fails, redirect to login
              // This would typically be handled by a navigation service
              print('Token refresh failed: $e');
            }
          }
          return handler.next(error);
        },
      ),
    );
  }

  // GET request
  Future<dynamic> get(String endpoint, {Map<String, dynamic>? queryParams}) async {
    try {
      final response = await _dio.get(
        '$_baseUrl$endpoint',
        queryParameters: queryParams,
      );
      return response.data;
    } catch (e) {
      _handleError(e);
    }
  }

  // POST request
  Future<dynamic> post(String endpoint, {dynamic data}) async {
    try {
      final response = await _dio.post(
        '$_baseUrl$endpoint',
        data: data,
      );
      return response.data;
    } catch (e) {
      _handleError(e);
    }
  }

  // PUT request
  Future<dynamic> put(String endpoint, {dynamic data}) async {
    try {
      final response = await _dio.put(
        '$_baseUrl$endpoint',
        data: data,
      );
      return response.data;
    } catch (e) {
      _handleError(e);
    }
  }

  // DELETE request
  Future<dynamic> delete(String endpoint) async {
    try {
      final response = await _dio.delete('$_baseUrl$endpoint');
      return response.data;
    } catch (e) {
      _handleError(e);
    }
  }

  // Error handling
  void _handleError(dynamic error) {
    if (error is DioException) {
      if (error.response != null) {
        throw Exception(error.response?.data['detail'] ?? error.message);
      } else {
        throw Exception(error.message);
      }
    } else {
      throw Exception(error.toString());
    }
  }
}
```

## State Management

This guide uses Riverpod for state management. Here's how to set up the providers:

```dart
// lib/providers/providers.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/auth/user.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';

// Services
final apiServiceProvider = Provider<ApiService>((ref) => ApiService());
final authServiceProvider = Provider<AuthService>((ref) => AuthService());

// Auth state
final authStateProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.watch(authServiceProvider));
});

// Auth notifier
class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _authService;

  AuthNotifier(this._authService) : super(AuthState.initial()) {
    checkAuth();
  }

  Future<void> checkAuth() async {
    state = state.copyWith(isLoading: true);
    try {
      final isAuth = await _authService.isAuthenticated();
      if (isAuth) {
        final user = await _authService.getCurrentUser();
        state = state.copyWith(
          isAuthenticated: true,
          user: user,
          isLoading: false,
        );
      } else {
        state = state.copyWith(
          isAuthenticated: false,
          user: null,
          isLoading: false,
        );
      }
    } catch (e) {
      state = state.copyWith(
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  Future<bool> login(String username, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _authService.login(username, password);
      final user = await _authService.getCurrentUser();
      state = state.copyWith(
        isAuthenticated: true,
        user: user,
        isLoading: false,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
      return false;
    }
  }

  Future<void> logout() async {
    state = state.copyWith(isLoading: true);
    try {
      await _authService.logout();
      state = state.copyWith(
        isAuthenticated: false,
        user: null,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }
}

// Auth state class
class AuthState {
  final bool isAuthenticated;
  final User? user;
  final bool isLoading;
  final String? error;

  AuthState({
    required this.isAuthenticated,
    this.user,
    required this.isLoading,
    this.error,
  });

  factory AuthState.initial() {
    return AuthState(
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null,
    );
  }

  AuthState copyWith({
    bool? isAuthenticated,
    User? user,
    bool? isLoading,
    String? error,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
    );
  }
}
```

## Dashboard Implementation

Create models for reports and branches:

```dart
// lib/models/branch.dart
import 'package:json_annotation/json_annotation.dart';

part 'branch.g.dart';

@JsonSerializable()
class Branch {
  final String id;
  final String code;
  final String name;
  final bool isActive;
  final String? parentId;

  Branch({
    required this.id,
    required this.code,
    required this.name,
    required this.isActive,
    this.parentId,
  });

  factory Branch.fromJson(Map<String, dynamic> json) => _$BranchFromJson(json);
  Map<String, dynamic> toJson() => _$BranchToJson(this);
}

// lib/models/report.dart
import 'package:json_annotation/json_annotation.dart';
import 'branch.dart';
import 'auth/user.dart';

part 'report.g.dart';

@JsonSerializable()
class Report {
  final String id;
  final String branchId;
  final double writeOffs;
  final double ninetyPlus;
  final String reportType;
  final String status;
  final String submittedBy;
  final String submittedAt;
  final DateTime date;
  final DateTime createdAt;
  final DateTime? updatedAt;
  final String? planReportId;
  final Branch? branch;
  final User? submitter;
  final double? writeOffsPlan;
  final double? ninetyPlusPlan;

  Report({
    required this.id,
    required this.branchId,
    required this.writeOffs,
    required this.ninetyPlus,
    required this.reportType,
    required this.status,
    required this.submittedBy,
    required this.submittedAt,
    required this.date,
    required this.createdAt,
    this.updatedAt,
    this.planReportId,
    this.branch,
    this.submitter,
    this.writeOffsPlan,
    this.ninetyPlusPlan,
  });

  factory Report.fromJson(Map<String, dynamic> json) => _$ReportFromJson(json);
  Map<String, dynamic> toJson() => _$ReportToJson(this);
}
```

Create services for reports and branches:

```dart
// lib/services/branch_service.dart
import '../models/branch.dart';
import 'api_service.dart';

class BranchService {
  final ApiService _apiService;

  BranchService(this._apiService);

  Future<List<Branch>> getBranches() async {
    final response = await _apiService.get('/branches');
    return (response as List).map((item) => Branch.fromJson(item)).toList();
  }

  Future<Branch> getBranchById(String id) async {
    final response = await _apiService.get('/branches/$id');
    return Branch.fromJson(response);
  }
}

// lib/services/report_service.dart
import '../models/report.dart';
import 'api_service.dart';

class ReportService {
  final ApiService _apiService;

  ReportService(this._apiService);

  Future<Map<String, dynamic>> getReports({
    int skip = 0,
    int limit = 10,
    String? branchId,
    String? reportType,
    String? status,
    DateTime? startDate,
    DateTime? endDate,
    String sortBy = 'date',
    String sortOrder = 'desc',
  }) async {
    final queryParams = {
      'skip': skip.toString(),
      'limit': limit.toString(),
      'sort_by': sortBy,
      'sort_order': sortOrder,
    };

    if (branchId != null) queryParams['branch_id'] = branchId;
    if (reportType != null) queryParams['report_type'] = reportType;
    if (status != null) queryParams['status'] = status;
    if (startDate != null) queryParams['start_date'] = startDate.toIso8601String().split('T')[0];
    if (endDate != null) queryParams['end_date'] = endDate.toIso8601String().split('T')[0];

    final response = await _apiService.get('/reports', queryParams: queryParams);

    final reports = (response['data'] as List).map((item) => Report.fromJson(item)).toList();

    return {
      'reports': reports,
      'total': response['total'],
      'page': response['page'],
      'limit': response['limit'],
      'totalPages': response['totalPages'],
    };
  }

  Future<Report> getReportById(String id) async {
    final response = await _apiService.get('/reports/$id');
    return Report.fromJson(response);
  }

  Future<Report> createReport(Map<String, dynamic> data) async {
    final response = await _apiService.post('/reports', data: data);
    return Report.fromJson(response);
  }

  Future<Report> updateReport(String id, Map<String, dynamic> data) async {
    final response = await _apiService.put('/reports/$id', data: data);
    return Report.fromJson(response);
  }

  Future<void> deleteReport(String id) async {
    await _apiService.delete('/reports/$id');
  }
}
```

Create providers for reports and branches:

```dart
// Add to lib/providers/providers.dart

// Services
final branchServiceProvider = Provider<BranchService>((ref) {
  return BranchService(ref.watch(apiServiceProvider));
});

final reportServiceProvider = Provider<ReportService>((ref) {
  return ReportService(ref.watch(apiServiceProvider));
});

// Branch providers
final branchesProvider = FutureProvider<List<Branch>>((ref) async {
  final branchService = ref.watch(branchServiceProvider);
  return branchService.getBranches();
});

final branchProvider = FutureProvider.family<Branch, String>((ref, id) async {
  final branchService = ref.watch(branchServiceProvider);
  return branchService.getBranchById(id);
});

// Report providers
final reportsProvider = FutureProvider.family<Map<String, dynamic>, Map<String, dynamic>>((ref, params) async {
  final reportService = ref.watch(reportServiceProvider);
  return reportService.getReports(
    skip: params['skip'] ?? 0,
    limit: params['limit'] ?? 10,
    branchId: params['branchId'],
    reportType: params['reportType'],
    status: params['status'],
    startDate: params['startDate'],
    endDate: params['endDate'],
    sortBy: params['sortBy'] ?? 'date',
    sortOrder: params['sortOrder'] ?? 'desc',
  );
});

final reportProvider = FutureProvider.family<Report, String>((ref, id) async {
  final reportService = ref.watch(reportServiceProvider);
  return reportService.getReportById(id);
});
```

Create a dashboard screen:

```dart
// lib/screens/dashboard_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/providers.dart';
import '../models/report.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final reportsAsync = ref.watch(reportsProvider({
      'limit': 5,
      'sortBy': 'date',
      'sortOrder': 'desc',
    }));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              ref.read(authStateProvider.notifier).logout();
            },
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Welcome, ${authState.user?.name ?? 'User'}',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(
                  'Role: ${authState.user?.role ?? 'Unknown'}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if (authState.user?.branchId != null)
                  FutureBuilder(
                    future: ref.read(branchServiceProvider).getBranchById(authState.user!.branchId!),
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Text('Loading branch...');
                      }
                      if (snapshot.hasError) {
                        return Text('Error: ${snapshot.error}');
                      }
                      if (snapshot.hasData) {
                        return Text(
                          'Branch: ${snapshot.data!.name}',
                          style: Theme.of(context).textTheme.titleMedium,
                        );
                      }
                      return const SizedBox();
                    },
                  ),
              ],
            ),
          ),
          const Divider(),
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Text(
              'Recent Reports',
              style: Theme.of(context).textTheme.titleLarge,
            ),
          ),
          Expanded(
            child: reportsAsync.when(
              data: (data) {
                final reports = data['reports'] as List<Report>;
                if (reports.isEmpty) {
                  return const Center(
                    child: Text('No reports found'),
                  );
                }
                return ListView.builder(
                  itemCount: reports.length,
                  itemBuilder: (context, index) {
                    final report = reports[index];
                    return ListTile(
                      title: Text('${report.branch?.name ?? 'Unknown Branch'} - ${DateFormat('dd/MMM/yyyy').format(report.date)}'),
                      subtitle: Text('Type: ${report.reportType}, Status: ${report.status}'),
                      trailing: Text(
                        'Write-offs: ${report.writeOffs.toStringAsFixed(2)}\n90+: ${report.ninetyPlus.toStringAsFixed(2)}',
                        textAlign: TextAlign.end,
                      ),
                      onTap: () {
                        // Navigate to report details
                      },
                    );
                  },
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, stack) => Center(child: Text('Error: $error')),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // Navigate to create report screen
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}
```

## Report Management

Create a report list screen:

```dart
// lib/screens/report_list_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/providers.dart';
import '../models/report.dart';

class ReportListScreen extends ConsumerStatefulWidget {
  const ReportListScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<ReportListScreen> createState() => _ReportListScreenState();
}

class _ReportListScreenState extends ConsumerState<ReportListScreen> {
  int _page = 1;
  int _limit = 20;
  String? _branchId;
  String? _reportType;
  String? _status;
  DateTime? _startDate;
  DateTime? _endDate;
  String _sortBy = 'date';
  String _sortOrder = 'desc';

  @override
  Widget build(BuildContext context) {
    final reportsAsync = ref.watch(reportsProvider({
      'skip': (_page - 1) * _limit,
      'limit': _limit,
      'branchId': _branchId,
      'reportType': _reportType,
      'status': _status,
      'startDate': _startDate,
      'endDate': _endDate,
      'sortBy': _sortBy,
      'sortOrder': _sortOrder,
    }));

    final branchesAsync = ref.watch(branchesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Reports'),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () {
              _showFilterDialog(context);
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter chips
          if (_branchId != null || _reportType != null || _status != null || _startDate != null || _endDate != null)
            Padding(
              padding: const EdgeInsets.all(8.0),
              child: Wrap(
                spacing: 8.0,
                children: [
                  if (_branchId != null)
                    branchesAsync.when(
                      data: (branches) {
                        final branch = branches.firstWhere(
                          (b) => b.id == _branchId,
                          orElse: () => Branch(id: '', code: '', name: 'Unknown', isActive: true),
                        );
                        return FilterChip(
                          label: Text('Branch: ${branch.name}'),
                          onSelected: (_) {
                            setState(() {
                              _branchId = null;
                            });
                          },
                        );
                      },
                      loading: () => const SizedBox(),
                      error: (_, __) => const SizedBox(),
                    ),
                  if (_reportType != null)
                    FilterChip(
                      label: Text('Type: $_reportType'),
                      onSelected: (_) {
                        setState(() {
                          _reportType = null;
                        });
                      },
                    ),
                  if (_status != null)
                    FilterChip(
                      label: Text('Status: $_status'),
                      onSelected: (_) {
                        setState(() {
                          _status = null;
                        });
                      },
                    ),
                  if (_startDate != null)
                    FilterChip(
                      label: Text('From: ${DateFormat('dd/MM/yyyy').format(_startDate!)}'),
                      onSelected: (_) {
                        setState(() {
                          _startDate = null;
                        });
                      },
                    ),
                  if (_endDate != null)
                    FilterChip(
                      label: Text('To: ${DateFormat('dd/MM/yyyy').format(_endDate!)}'),
                      onSelected: (_) {
                        setState(() {
                          _endDate = null;
                        });
                      },
                    ),
                  FilterChip(
                    label: const Text('Clear All'),
                    onSelected: (_) {
                      setState(() {
                        _branchId = null;
                        _reportType = null;
                        _status = null;
                        _startDate = null;
                        _endDate = null;
                      });
                    },
                  ),
                ],
              ),
            ),
          // Reports list
          Expanded(
            child: reportsAsync.when(
              data: (data) {
                final reports = data['reports'] as List<Report>;
                final total = data['total'] as int;
                final totalPages = data['totalPages'] as int;

                if (reports.isEmpty) {
                  return const Center(
                    child: Text('No reports found'),
                  );
                }

                return Column(
                  children: [
                    Expanded(
                      child: ListView.builder(
                        itemCount: reports.length,
                        itemBuilder: (context, index) {
                          final report = reports[index];
                          return ListTile(
                            title: Text('${report.branch?.name ?? 'Unknown Branch'} - ${DateFormat('dd/MMM/yyyy').format(report.date)}'),
                            subtitle: Text('Type: ${report.reportType}, Status: ${report.status}'),
                            trailing: Text(
                              'Write-offs: ${report.writeOffs.toStringAsFixed(2)}\n90+: ${report.ninetyPlus.toStringAsFixed(2)}',
                              textAlign: TextAlign.end,
                            ),
                            onTap: () {
                              // Navigate to report details
                            },
                          );
                        },
                      ),
                    ),
                    // Pagination
                    Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.chevron_left),
                            onPressed: _page > 1
                                ? () {
                                    setState(() {
                                      _page--;
                                    });
                                  }
                                : null,
                          ),
                          Text('Page $_page of $totalPages'),
                          IconButton(
                            icon: const Icon(Icons.chevron_right),
                            onPressed: _page < totalPages
                                ? () {
                                    setState(() {
                                      _page++;
                                    });
                                  }
                                : null,
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, stack) => Center(child: Text('Error: $error')),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // Navigate to create report screen
        },
        child: const Icon(Icons.add),
      ),
    );
  }

  void _showFilterDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Filter Reports'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Branch filter
                Consumer(
                  builder: (context, ref, child) {
                    final branchesAsync = ref.watch(branchesProvider);
                    return branchesAsync.when(
                      data: (branches) {
                        return DropdownButtonFormField<String>(
                          decoration: const InputDecoration(labelText: 'Branch'),
                          value: _branchId,
                          items: [
                            const DropdownMenuItem<String>(
                              value: null,
                              child: Text('All Branches'),
                            ),
                            ...branches.map((branch) {
                              return DropdownMenuItem<String>(
                                value: branch.id,
                                child: Text(branch.name),
                              );
                            }).toList(),
                          ],
                          onChanged: (value) {
                            setState(() {
                              _branchId = value;
                            });
                          },
                        );
                      },
                      loading: () => const CircularProgressIndicator(),
                      error: (_, __) => const Text('Failed to load branches'),
                    );
                  },
                ),
                // Report type filter
                DropdownButtonFormField<String>(
                  decoration: const InputDecoration(labelText: 'Report Type'),
                  value: _reportType,
                  items: const [
                    DropdownMenuItem<String>(
                      value: null,
                      child: Text('All Types'),
                    ),
                    DropdownMenuItem<String>(
                      value: 'plan',
                      child: Text('Plan'),
                    ),
                    DropdownMenuItem<String>(
                      value: 'actual',
                      child: Text('Actual'),
                    ),
                  ],
                  onChanged: (value) {
                    setState(() {
                      _reportType = value;
                    });
                  },
                ),
                // Status filter
                DropdownButtonFormField<String>(
                  decoration: const InputDecoration(labelText: 'Status'),
                  value: _status,
                  items: const [
                    DropdownMenuItem<String>(
                      value: null,
                      child: Text('All Statuses'),
                    ),
                    DropdownMenuItem<String>(
                      value: 'pending',
                      child: Text('Pending'),
                    ),
                    DropdownMenuItem<String>(
                      value: 'approved',
                      child: Text('Approved'),
                    ),
                    DropdownMenuItem<String>(
                      value: 'rejected',
                      child: Text('Rejected'),
                    ),
                  ],
                  onChanged: (value) {
                    setState(() {
                      _status = value;
                    });
                  },
                ),
                // Date range filter
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        decoration: const InputDecoration(labelText: 'Start Date'),
                        readOnly: true,
                        controller: TextEditingController(
                          text: _startDate != null ? DateFormat('dd/MM/yyyy').format(_startDate!) : '',
                        ),
                        onTap: () async {
                          final date = await showDatePicker(
                            context: context,
                            initialDate: _startDate ?? DateTime.now(),
                            firstDate: DateTime(2020),
                            lastDate: DateTime.now(),
                          );
                          if (date != null) {
                            setState(() {
                              _startDate = date;
                            });
                          }
                        },
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: TextFormField(
                        decoration: const InputDecoration(labelText: 'End Date'),
                        readOnly: true,
                        controller: TextEditingController(
                          text: _endDate != null ? DateFormat('dd/MM/yyyy').format(_endDate!) : '',
                        ),
                        onTap: () async {
                          final date = await showDatePicker(
                            context: context,
                            initialDate: _endDate ?? DateTime.now(),
                            firstDate: DateTime(2020),
                            lastDate: DateTime.now(),
                          );
                          if (date != null) {
                            setState(() {
                              _endDate = date;
                            });
                          }
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
              },
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () {
                setState(() {
                  _page = 1; // Reset to first page when applying filters
                });
                Navigator.of(context).pop();
              },
              child: const Text('Apply'),
            ),
          ],
        );
      },
    );
  }
}
```

## Real-time Updates

Create a WebSocket service for real-time updates:

```dart
// lib/services/websocket_service.dart
import 'dart:async';
import 'dart:convert';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

class WebSocketService {
  WebSocketChannel? _channel;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final String _baseUrl = dotenv.env['WS_BASE_URL'] ?? '';

  final StreamController<Map<String, dynamic>> _messageController =
      StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get messageStream => _messageController.stream;

  bool _isConnected = false;
  bool get isConnected => _isConnected;

  Future<void> connect() async {
    if (_isConnected) return;

    try {
      final token = await _storage.read(key: 'access_token');
      if (token == null) {
        throw Exception('Not authenticated');
      }

      final uri = Uri.parse('$_baseUrl/realtime?token=$token');
      _channel = WebSocketChannel.connect(uri);

      _channel!.stream.listen(
        (message) {
          try {
            final data = jsonDecode(message) as Map<String, dynamic>;
            _messageController.add(data);
          } catch (e) {
            print('Error parsing WebSocket message: $e');
          }
        },
        onDone: () {
          _isConnected = false;
          print('WebSocket connection closed');
        },
        onError: (error) {
          _isConnected = false;
          print('WebSocket error: $error');
        },
      );

      _isConnected = true;
    } catch (e) {
      _isConnected = false;
      print('WebSocket connection error: $e');
      rethrow;
    }
  }

  void disconnect() {
    _channel?.sink.close();
    _isConnected = false;
  }

  void dispose() {
    disconnect();
    _messageController.close();
  }
}
```

Create a polling service as a fallback:

```dart
// lib/services/polling_service.dart
import 'dart:async';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'api_service.dart';

class PollingService {
  final ApiService _apiService;
  Timer? _timer;
  DateTime _lastPollTime = DateTime.now();

  final StreamController<Map<String, dynamic>> _updateController =
      StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get updateStream => _updateController.stream;

  bool _isPolling = false;
  bool get isPolling => _isPolling;

  PollingService(this._apiService);

  void startPolling({int intervalSeconds = 10}) {
    if (_isPolling) return;

    _isPolling = true;
    _lastPollTime = DateTime.now();

    // Initial poll
    _poll();

    // Set up periodic polling
    _timer = Timer.periodic(
      Duration(seconds: intervalSeconds),
      (_) => _poll(),
    );
  }

  void stopPolling() {
    _timer?.cancel();
    _timer = null;
    _isPolling = false;
  }

  Future<void> _poll() async {
    try {
      final response = await _apiService.get(
        '/realtime/polling',
        queryParams: {
          'since': _lastPollTime.toIso8601String(),
        },
      );

      _lastPollTime = DateTime.now();

      if (response != null && response['events'] != null) {
        final events = response['events'] as List;
        for (final event in events) {
          _updateController.add(event as Map<String, dynamic>);
        }
      }
    } catch (e) {
      print('Polling error: $e');
    }
  }

  void dispose() {
    stopPolling();
    _updateController.close();
  }
}
```

Create a hybrid real-time service that combines WebSocket and polling:

```dart
// lib/services/realtime_service.dart
import 'dart:async';
import 'websocket_service.dart';
import 'polling_service.dart';
import 'api_service.dart';

enum RealtimeMethod {
  websocket,
  polling,
  none
}

class RealtimeService {
  final WebSocketService _websocketService;
  final PollingService _pollingService;

  RealtimeMethod _activeMethod = RealtimeMethod.none;
  RealtimeMethod get activeMethod => _activeMethod;

  final StreamController<Map<String, dynamic>> _eventController =
      StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get eventStream => _eventController.stream;

  StreamSubscription? _wsSubscription;
  StreamSubscription? _pollSubscription;

  RealtimeService({
    required WebSocketService websocketService,
    required PollingService pollingService,
  }) :
    _websocketService = websocketService,
    _pollingService = pollingService;

  Future<void> connect() async {
    // Try WebSocket first
    try {
      await _websocketService.connect();
      _activeMethod = RealtimeMethod.websocket;

      // Listen to WebSocket events
      _wsSubscription = _websocketService.messageStream.listen(
        (event) {
          _eventController.add(event);
        },
        onError: (error) {
          print('WebSocket stream error: $error');
          // Fall back to polling if WebSocket fails
          _fallbackToPolling();
        },
      );

      print('Connected via WebSocket');
    } catch (e) {
      print('WebSocket connection failed: $e');
      // Fall back to polling
      _fallbackToPolling();
    }
  }

  void _fallbackToPolling() {
    print('Falling back to polling');
    _wsSubscription?.cancel();
    _activeMethod = RealtimeMethod.polling;

    // Start polling
    _pollingService.startPolling();

    // Listen to polling events
    _pollSubscription = _pollingService.updateStream.listen(
      (event) {
        _eventController.add(event);
      },
      onError: (error) {
        print('Polling stream error: $error');
      },
    );
  }

  void disconnect() {
    _wsSubscription?.cancel();
    _pollSubscription?.cancel();
    _websocketService.disconnect();
    _pollingService.stopPolling();
    _activeMethod = RealtimeMethod.none;
  }

  void dispose() {
    disconnect();
    _eventController.close();
  }
}
```

Create a provider for the real-time service:

```dart
// Add to lib/providers/providers.dart

// Real-time services
final websocketServiceProvider = Provider<WebSocketService>((ref) {
  return WebSocketService();
});

final pollingServiceProvider = Provider<PollingService>((ref) {
  return PollingService(ref.watch(apiServiceProvider));
});

final realtimeServiceProvider = Provider<RealtimeService>((ref) {
  return RealtimeService(
    websocketService: ref.watch(websocketServiceProvider),
    pollingService: ref.watch(pollingServiceProvider),
  );
});

// Real-time events stream
final realtimeEventsProvider = StreamProvider<Map<String, dynamic>>((ref) {
  final realtimeService = ref.watch(realtimeServiceProvider);

  // Connect to real-time service when provider is created
  realtimeService.connect();

  // Dispose of the service when provider is disposed
  ref.onDispose(() {
    realtimeService.dispose();
  });

  return realtimeService.eventStream;
});
```

Create a hook to use real-time updates in your widgets:

```dart
// lib/hooks/use_realtime.dart
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../providers/providers.dart';
import '../services/realtime_service.dart';

typedef EventHandler = void Function(Map<String, dynamic> event);

class RealtimeHook {
  final bool isConnected;
  final RealtimeMethod activeMethod;
  final Map<String, dynamic>? lastEvent;
  final String? error;
  final VoidCallback reconnect;
  final VoidCallback disconnect;

  RealtimeHook({
    required this.isConnected,
    required this.activeMethod,
    this.lastEvent,
    this.error,
    required this.reconnect,
    required this.disconnect,
  });
}

RealtimeHook useRealtime({
  Map<String, EventHandler>? eventHandlers,
}) {
  final realtimeService = useProvider(realtimeServiceProvider);
  final realtimeEvents = useProvider(realtimeEventsProvider);

  final lastEventState = useState<Map<String, dynamic>?>(null);
  final errorState = useState<String?>(null);

  // Handle events
  useEffect(() {
    final subscription = realtimeService.eventStream.listen(
      (event) {
        lastEventState.value = event;
        errorState.value = null;

        // Call the appropriate event handler based on event type
        final eventType = event['type'] as String?;
        if (eventType != null && eventHandlers != null && eventHandlers.containsKey(eventType)) {
          eventHandlers[eventType]!(event);
        }
      },
      onError: (error) {
        errorState.value = error.toString();
      },
    );

    return subscription.cancel;
  }, [realtimeService]);

  // Connect on mount
  useEffect(() {
    realtimeService.connect();
    return null;
  }, []);

  return RealtimeHook(
    isConnected: realtimeService.activeMethod != RealtimeMethod.none,
    activeMethod: realtimeService.activeMethod,
    lastEvent: lastEventState.value,
    error: errorState.value,
    reconnect: () {
      realtimeService.disconnect();
      realtimeService.connect();
    },
    disconnect: realtimeService.disconnect,
  );
}
```

## Notifications

Create a notification service:

```dart
// lib/services/notification_service.dart
import 'dart:async';
import 'dart:convert';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/notification.dart';

class NotificationService {
  final FlutterLocalNotificationsPlugin _flutterLocalNotificationsPlugin =
      FlutterLocalNotificationsPlugin();

  final StreamController<NotificationModel> _notificationStreamController =
      StreamController<NotificationModel>.broadcast();

  Stream<NotificationModel> get onNotification => _notificationStreamController.stream;

  Future<void> init() async {
    // Initialize local notifications
    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('app_icon');

    const DarwinInitializationSettings initializationSettingsIOS =
        DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const InitializationSettings initializationSettings = InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsIOS,
    );

    await _flutterLocalNotificationsPlugin.initialize(
      initializationSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        // Handle notification tap
        if (response.payload != null) {
          try {
            final payload = jsonDecode(response.payload!) as Map<String, dynamic>;
            final notification = NotificationModel.fromJson(payload);
            _notificationStreamController.add(notification);
          } catch (e) {
            print('Error parsing notification payload: $e');
          }
        }
      },
    );
  }

  Future<void> showNotification({
    required String title,
    required String body,
    String? payload,
  }) async {
    const AndroidNotificationDetails androidPlatformChannelSpecifics =
        AndroidNotificationDetails(
      'lc_reports_channel',
      'LC Reports Notifications',
      channelDescription: 'Notifications from LC Reports',
      importance: Importance.max,
      priority: Priority.high,
    );

    const DarwinNotificationDetails iOSPlatformChannelSpecifics =
        DarwinNotificationDetails();

    const NotificationDetails platformChannelSpecifics = NotificationDetails(
      android: androidPlatformChannelSpecifics,
      iOS: iOSPlatformChannelSpecifics,
    );

    await _flutterLocalNotificationsPlugin.show(
      0,
      title,
      body,
      platformChannelSpecifics,
      payload: payload,
    );
  }

  Future<List<NotificationModel>> getNotificationHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final notificationsJson = prefs.getStringList('notifications') ?? [];

    return notificationsJson
        .map((json) => NotificationModel.fromJson(jsonDecode(json) as Map<String, dynamic>))
        .toList();
  }

  Future<void> saveNotification(NotificationModel notification) async {
    final prefs = await SharedPreferences.getInstance();
    final notificationsJson = prefs.getStringList('notifications') ?? [];

    // Add new notification to the list
    notificationsJson.insert(0, jsonEncode(notification.toJson()));

    // Keep only the last 50 notifications
    if (notificationsJson.length > 50) {
      notificationsJson.removeRange(50, notificationsJson.length);
    }

    await prefs.setStringList('notifications', notificationsJson);
  }

  Future<void> markAsRead(String notificationId) async {
    final prefs = await SharedPreferences.getInstance();
    final notificationsJson = prefs.getStringList('notifications') ?? [];

    final updatedNotifications = notificationsJson.map((json) {
      final notification = NotificationModel.fromJson(jsonDecode(json) as Map<String, dynamic>);
      if (notification.id == notificationId) {
        notification.isRead = true;
      }
      return jsonEncode(notification.toJson());
    }).toList();

    await prefs.setStringList('notifications', updatedNotifications);
  }

  Future<void> clearAll() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('notifications');
  }

  void dispose() {
    _notificationStreamController.close();
  }
}
```

Create a notification model:

```dart
// lib/models/notification.dart
import 'package:json_annotation/json_annotation.dart';

part 'notification.g.dart';

@JsonSerializable()
class NotificationModel {
  final String id;
  final String title;
  final String body;
  final String type;
  final DateTime createdAt;
  final Map<String, dynamic>? data;
  final String? actionUrl;
  bool isRead;

  NotificationModel({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.createdAt,
    this.data,
    this.actionUrl,
    this.isRead = false,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) => _$NotificationModelFromJson(json);
  Map<String, dynamic> toJson() => _$NotificationModelToJson(this);
}
```

Create a notification provider:

```dart
// Add to lib/providers/providers.dart

// Notification service
final notificationServiceProvider = Provider<NotificationService>((ref) {
  final service = NotificationService();
  service.init();

  // Dispose of the service when provider is disposed
  ref.onDispose(() {
    service.dispose();
  });

  return service;
});

// Notification history
final notificationHistoryProvider = FutureProvider<List<NotificationModel>>((ref) async {
  final notificationService = ref.watch(notificationServiceProvider);
  return notificationService.getNotificationHistory();
});

// Notification stream
final notificationStreamProvider = StreamProvider<NotificationModel>((ref) {
  final notificationService = ref.watch(notificationServiceProvider);
  return notificationService.onNotification;
});
```

Create a notification listener component:

```dart
// lib/components/notification_listener.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/providers.dart';
import '../services/realtime_service.dart';

class NotificationListener extends ConsumerWidget {
  final Widget child;

  const NotificationListener({
    Key? key,
    required this.child,
  }) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Listen to real-time events
    ref.listen<AsyncValue<Map<String, dynamic>>>(
      realtimeEventsProvider,
      (_, next) {
        next.whenData((event) {
          // Handle notification events
          if (event['type'] == 'notification') {
            final notificationService = ref.read(notificationServiceProvider);

            // Show local notification
            notificationService.showNotification(
              title: event['title'] ?? 'New Notification',
              body: event['message'] ?? '',
              payload: event.toString(),
            );

            // Save notification to history
            final notification = NotificationModel(
              id: event['id'] ?? DateTime.now().toIso8601String(),
              title: event['title'] ?? 'New Notification',
              body: event['message'] ?? '',
              type: event['notificationType'] ?? 'general',
              createdAt: DateTime.now(),
              data: event['data'] as Map<String, dynamic>?,
              actionUrl: event['actionUrl'] as String?,
            );

            notificationService.saveNotification(notification);
          }
        });
      },
    );

    // Connect to real-time service when widget is built
    final realtimeService = ref.watch(realtimeServiceProvider);
    if (realtimeService.activeMethod == RealtimeMethod.none) {
      realtimeService.connect();
    }

    return child;
  }
}
```

## Offline Support

Create a connectivity service to monitor network status:

```dart
// lib/services/connectivity_service.dart
import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';

class ConnectivityService {
  final Connectivity _connectivity = Connectivity();
  final StreamController<bool> _connectionStatusController = StreamController<bool>.broadcast();

  Stream<bool> get connectionStatus => _connectionStatusController.stream;

  bool _isConnected = true;
  bool get isConnected => _isConnected;

  ConnectivityService() {
    // Initialize connection status
    _checkConnectivity();

    // Listen for connectivity changes
    _connectivity.onConnectivityChanged.listen((result) {
      _updateConnectionStatus(result);
    });
  }

  Future<void> _checkConnectivity() async {
    final result = await _connectivity.checkConnectivity();
    _updateConnectionStatus(result);
  }

  void _updateConnectionStatus(ConnectivityResult result) {
    _isConnected = result != ConnectivityResult.none;
    _connectionStatusController.add(_isConnected);
  }

  void dispose() {
    _connectionStatusController.close();
  }
}
```

Create a local storage service for offline data:

```dart
// lib/services/local_storage_service.dart
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class LocalStorageService {
  final SharedPreferences _prefs;

  LocalStorageService(this._prefs);

  // Save data to local storage
  Future<void> saveData(String key, dynamic data) async {
    if (data is String) {
      await _prefs.setString(key, data);
    } else if (data is bool) {
      await _prefs.setBool(key, data);
    } else if (data is int) {
      await _prefs.setInt(key, data);
    } else if (data is double) {
      await _prefs.setDouble(key, data);
    } else if (data is List<String>) {
      await _prefs.setStringList(key, data);
    } else {
      // Convert complex objects to JSON string
      await _prefs.setString(key, jsonEncode(data));
    }
  }

  // Get data from local storage
  dynamic getData(String key, {Type? type}) {
    if (type == String) {
      return _prefs.getString(key);
    } else if (type == bool) {
      return _prefs.getBool(key);
    } else if (type == int) {
      return _prefs.getInt(key);
    } else if (type == double) {
      return _prefs.getDouble(key);
    } else if (type == List<String>) {
      return _prefs.getStringList(key);
    } else {
      // Try to parse as JSON
      final data = _prefs.getString(key);
      if (data != null) {
        try {
          return jsonDecode(data);
        } catch (e) {
          return data;
        }
      }
      return null;
    }
  }

  // Remove data from local storage
  Future<bool> removeData(String key) async {
    return await _prefs.remove(key);
  }

  // Clear all data from local storage
  Future<bool> clearAll() async {
    return await _prefs.clear();
  }
}
```

Create an offline-capable API service:

```dart
// lib/services/offline_api_service.dart
import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';
import 'connectivity_service.dart';
import 'local_storage_service.dart';

class OfflineApiService {
  final ApiService _apiService;
  final ConnectivityService _connectivityService;
  final LocalStorageService _localStorageService;

  // Queue for pending requests
  final List<Map<String, dynamic>> _pendingRequests = [];

  OfflineApiService({
    required ApiService apiService,
    required ConnectivityService connectivityService,
    required LocalStorageService localStorageService,
  }) :
    _apiService = apiService,
    _connectivityService = connectivityService,
    _localStorageService = localStorageService {
    // Listen for connectivity changes
    _connectivityService.connectionStatus.listen((isConnected) {
      if (isConnected) {
        _processPendingRequests();
      }
    });

    // Load pending requests from storage
    _loadPendingRequests();
  }

  Future<void> _loadPendingRequests() async {
    final pendingRequestsJson = _localStorageService.getData('pending_requests');
    if (pendingRequestsJson != null) {
      final requests = pendingRequestsJson as List;
      _pendingRequests.addAll(
        requests.map((request) => request as Map<String, dynamic>).toList(),
      );
    }
  }

  Future<void> _savePendingRequests() async {
    await _localStorageService.saveData('pending_requests', _pendingRequests);
  }

  Future<void> _processPendingRequests() async {
    if (_pendingRequests.isEmpty) return;

    // Process each pending request
    final requests = List<Map<String, dynamic>>.from(_pendingRequests);
    _pendingRequests.clear();
    await _savePendingRequests();

    for (final request in requests) {
      try {
        final method = request['method'] as String;
        final endpoint = request['endpoint'] as String;
        final data = request['data'];
        final queryParams = request['queryParams'] as Map<String, dynamic>?;

        switch (method) {
          case 'GET':
            await _apiService.get(endpoint, queryParams: queryParams);
            break;
          case 'POST':
            await _apiService.post(endpoint, data: data);
            break;
          case 'PUT':
            await _apiService.put(endpoint, data: data);
            break;
          case 'DELETE':
            await _apiService.delete(endpoint);
            break;
        }
      } catch (e) {
        // If request fails, add it back to the queue
        _pendingRequests.add(request);
        await _savePendingRequests();
      }
    }
  }

  // GET request with offline support
  Future<dynamic> get(String endpoint, {Map<String, dynamic>? queryParams, bool offlineEnabled = true}) async {
    try {
      // Try to make the request
      final response = await _apiService.get(endpoint, queryParams: queryParams);

      // If successful, cache the response
      if (offlineEnabled) {
        final cacheKey = 'cache_${endpoint}_${queryParams.toString()}';
        await _localStorageService.saveData(cacheKey, response);
      }

      return response;
    } catch (e) {
      // If offline and the request is enabled for offline
      if (!_connectivityService.isConnected && offlineEnabled) {
        // Try to get cached data
        final cacheKey = 'cache_${endpoint}_${queryParams.toString()}';
        final cachedData = _localStorageService.getData(cacheKey);

        if (cachedData != null) {
          return cachedData;
        }
      }

      // Rethrow the error if no cached data
      rethrow;
    }
  }

  // POST request with offline support
  Future<dynamic> post(String endpoint, {dynamic data, bool queueIfOffline = true}) async {
    try {
      // Try to make the request
      return await _apiService.post(endpoint, data: data);
    } catch (e) {
      // If offline and queueing is enabled
      if (!_connectivityService.isConnected && queueIfOffline) {
        // Add to pending requests
        _pendingRequests.add({
          'method': 'POST',
          'endpoint': endpoint,
          'data': data,
        });

        await _savePendingRequests();

        // Return a placeholder response
        return {'status': 'queued', 'message': 'Request queued for processing when online'};
      }

      // Rethrow the error
      rethrow;
    }
  }

  // PUT request with offline support
  Future<dynamic> put(String endpoint, {dynamic data, bool queueIfOffline = true}) async {
    try {
      // Try to make the request
      return await _apiService.put(endpoint, data: data);
    } catch (e) {
      // If offline and queueing is enabled
      if (!_connectivityService.isConnected && queueIfOffline) {
        // Add to pending requests
        _pendingRequests.add({
          'method': 'PUT',
          'endpoint': endpoint,
          'data': data,
        });

        await _savePendingRequests();

        // Return a placeholder response
        return {'status': 'queued', 'message': 'Request queued for processing when online'};
      }

      // Rethrow the error
      rethrow;
    }
  }

  // DELETE request with offline support
  Future<dynamic> delete(String endpoint, {bool queueIfOffline = true}) async {
    try {
      // Try to make the request
      return await _apiService.delete(endpoint);
    } catch (e) {
      // If offline and queueing is enabled
      if (!_connectivityService.isConnected && queueIfOffline) {
        // Add to pending requests
        _pendingRequests.add({
          'method': 'DELETE',
          'endpoint': endpoint,
        });

        await _savePendingRequests();

        // Return a placeholder response
        return {'status': 'queued', 'message': 'Request queued for processing when online'};
      }

      // Rethrow the error
      rethrow;
    }
  }
}
```

Create providers for offline support:

```dart
// Add to lib/providers/providers.dart

// Connectivity service
final connectivityServiceProvider = Provider<ConnectivityService>((ref) {
  final service = ConnectivityService();

  ref.onDispose(() {
    service.dispose();
  });

  return service;
});

// Local storage service
final localStorageServiceProvider = Provider<LocalStorageService>((ref) async {
  final prefs = await SharedPreferences.getInstance();
  return LocalStorageService(prefs);
});

// Offline API service
final offlineApiServiceProvider = Provider<OfflineApiService>((ref) {
  return OfflineApiService(
    apiService: ref.watch(apiServiceProvider),
    connectivityService: ref.watch(connectivityServiceProvider),
    localStorageService: ref.watch(localStorageServiceProvider),
  );
});

// Connection status stream
final connectionStatusProvider = StreamProvider<bool>((ref) {
  final connectivityService = ref.watch(connectivityServiceProvider);
  return connectivityService.connectionStatus;
});
```

Create a network-aware widget:

```dart
// lib/components/network_aware.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/providers.dart';

class NetworkAware extends ConsumerWidget {
  final Widget child;
  final Widget? offlineWidget;

  const NetworkAware({
    Key? key,
    required this.child,
    this.offlineWidget,
  }) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final connectionStatus = ref.watch(connectionStatusProvider);

    return connectionStatus.when(
      data: (isConnected) {
        if (isConnected) {
          return child;
        } else {
          return offlineWidget ??
            Stack(
              children: [
                child,
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: Material(
                    color: Colors.red,
                    child: Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Text(
                        'You are offline. Some features may be limited.',
                        style: TextStyle(color: Colors.white),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                ),
              ],
            );
        }
      },
      loading: () => child,
      error: (_, __) => child,
    );
  }
}
```

## Testing

Create unit tests for the API service:

```dart
// test/services/api_service_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:lc_reports_app/services/api_service.dart';

import 'api_service_test.mocks.dart';

@GenerateMocks([Dio, FlutterSecureStorage])
void main() {
  late MockDio mockDio;
  late MockFlutterSecureStorage mockStorage;
  late ApiService apiService;

  setUp(() {
    mockDio = MockDio();
    mockStorage = MockFlutterSecureStorage();
    apiService = ApiService();
    // Inject mocks
    apiService.dio = mockDio;
    apiService.storage = mockStorage;
  });

  group('ApiService', () {
    test('get should make a GET request with the correct URL', () async {
      // Arrange
      when(mockStorage.read(key: 'access_token')).thenAnswer((_) async => 'test_token');
      when(mockDio.get(
        any,
        queryParameters: anyNamed('queryParameters'),
        options: anyNamed('options'),
      )).thenAnswer((_) async => Response(
        data: {'success': true},
        statusCode: 200,
        requestOptions: RequestOptions(path: ''),
      ));

      // Act
      final result = await apiService.get('/test', queryParams: {'param': 'value'});

      // Assert
      verify(mockDio.get(
        'https://api.example.com/api/v1/test',
        queryParameters: {'param': 'value'},
        options: anyNamed('options'),
      )).called(1);
      expect(result, {'success': true});
    });

    // Add more tests for post, put, delete methods
  });
}
```

Create widget tests for the login screen:

```dart
// test/screens/login_screen_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';
import 'package:lc_reports_app/services/auth_service.dart';
import 'package:lc_reports_app/screens/login_screen.dart';
import 'package:lc_reports_app/providers/providers.dart';

import 'login_screen_test.mocks.dart';

@GenerateMocks([AuthService])
void main() {
  late MockAuthService mockAuthService;

  setUp(() {
    mockAuthService = MockAuthService();
  });

  testWidgets('LoginScreen shows error message on failed login', (WidgetTester tester) async {
    // Arrange
    when(mockAuthService.login(any, any)).thenThrow(Exception('Invalid credentials'));

    // Override the auth service provider for testing
    final container = ProviderContainer(
      overrides: [
        authServiceProvider.overrideWithValue(mockAuthService),
      ],
    );

    // Build the widget
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: LoginScreen(),
        ),
      ),
    );

    // Enter credentials
    await tester.enterText(find.byKey(Key('username_field')), 'testuser');
    await tester.enterText(find.byKey(Key('password_field')), 'password');

    // Tap the login button
    await tester.tap(find.byKey(Key('login_button')));
    await tester.pump();

    // Verify error message is displayed
    expect(find.text('Invalid credentials'), findsOneWidget);
  });

  // Add more tests for successful login, loading state, etc.
}
```

Create integration tests:

```dart
// integration_test/app_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:lc_reports_app/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('end-to-end test', () {
    testWidgets('login and navigate to dashboard', (WidgetTester tester) async {
      // Start the app
      app.main();
      await tester.pumpAndSettle();

      // Verify we're on the login screen
      expect(find.text('Login'), findsOneWidget);

      // Enter credentials
      await tester.enterText(find.byKey(Key('username_field')), 'testuser');
      await tester.enterText(find.byKey(Key('password_field')), 'password');

      // Tap the login button
      await tester.tap(find.byKey(Key('login_button')));
      await tester.pumpAndSettle();

      // Verify we're on the dashboard
      expect(find.text('Dashboard'), findsOneWidget);
      expect(find.text('Recent Reports'), findsOneWidget);
    });

    // Add more integration tests
  });
}
```

## Conclusion

This guide provides a comprehensive foundation for building a Flutter application that connects to the LC Reports Python API. It covers authentication, data fetching, real-time updates, notifications, and offline support.

To get started:

1. Set up your Flutter project with the required dependencies
2. Implement the authentication system
3. Create the API service layer
4. Build the UI components
5. Add real-time updates and notifications
6. Implement offline support
7. Write tests for your application

Remember to update the API endpoints and data models to match your specific requirements. The code provided in this guide is a starting point and may need to be adapted to your specific use case.

For more information, refer to the Python API documentation and the Flutter documentation.