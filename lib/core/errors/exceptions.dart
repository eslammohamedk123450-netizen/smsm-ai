class AppException implements Exception {
  final String message;
  final int? statusCode;
  final dynamic details;

  AppException(this.message, {this.statusCode, this.details});

  @override
  String toString() => 'AppException: $message${statusCode != null ? ' (status: $statusCode)' : ''}';
}

class AuthException extends AppException {
  AuthException({String message = 'Authentication failed', dynamic details})
      : super(message, statusCode: 401, details: details);
}

class NetworkException extends AppException {
  NetworkException({String message = 'Network error', dynamic details})
      : super(message, statusCode: 0, details: details);
}

class ServerException extends AppException {
  ServerException({String message = 'Server error', int statusCode = 500, dynamic details})
      : super(message, statusCode: statusCode, details: details);
}

class NotFoundException extends AppException {
  NotFoundException({String message = 'Resource not found', dynamic details})
      : super(message, statusCode: 404, details: details);
}

class ValidationException extends AppException {
  ValidationException({String message = 'Validation error', dynamic details})
      : super(message, statusCode: 422, details: details);
}

class InsufficientCreditsException extends AppException {
  InsufficientCreditsException({int? current, int? required})
      : super(
            'Insufficient credits',
            statusCode: 402,
            details: { 'current': current, 'required': required },
          );
}

class StreamException extends AppException {
  StreamException({String message = 'Stream error', dynamic details})
      : super(message, statusCode: 0, details: details);
}

class BannedUserException extends AppException {
  BannedUserException()
      : super('User account is banned', statusCode: 403);
}

class ModelSuspendedException extends AppException {
  ModelSuspendedException(String modelName)
      : super('Model $modelName is suspended', statusCode: 403);
}
