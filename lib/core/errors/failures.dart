import 'package:equatable/equatable.dart';

abstract class Failure extends Equatable {
  final String message;
  final int? code;

  const Failure(this.message, {this.code});

  @override
  List<Object?> get props => [message, code];
}

class ServerFailure extends Failure {
  const ServerFailure(super.message, {super.code});
}

class NetworkFailure extends Failure {
  const NetworkFailure(super.message, {super.code});
}

class AuthFailure extends Failure {
  const AuthFailure(super.message, {super.code});
}

class NotFoundFailure extends Failure {
  const NotFoundFailure(super.message, {super.code});
}

class ValidationFailure extends Failure {
  const ValidationFailure(super.message, {super.code});
}

class InsufficientCreditsFailure extends Failure {
  const InsufficientCreditsFailure(super.message, {super.code});
}

class StreamFailure extends Failure {
  const StreamFailure(super.message, {super.code});
}

class BannedUserFailure extends Failure {
  const BannedUserFailure(super.message, {super.code});
}

class ModelSuspendedFailure extends Failure {
  const ModelSuspendedFailure(super.message, {super.code});
}
