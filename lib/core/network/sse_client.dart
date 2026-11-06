import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../app_config.dart';

/// Typed SSE events emitted by the AI router stream.
sealed class SseEvent {}

class SseChunk extends SseEvent {
  SseChunk(this.text);
  final String text;
}

class SseToolEvent extends SseEvent {
  SseToolEvent({required this.tool, required this.status, this.message});
  final String tool;
  final String status;
  final String? message;
}

class SseDone extends SseEvent {
  SseDone({this.usage});
  final Map<String, dynamic>? usage;
}

class SseError extends SseEvent {
  SseError(this.message);
  final String message;
}

/// Client for the Supabase AI router SSE endpoint.
class SseClient {
  SseClient({
    http.Client? httpClient,
    Duration connectionTimeout = AppConfig.connectionTimeout,
    Duration streamTimeout = AppConfig.streamingTimeout,
    int maxAttempts = 3,
  })  : _httpClient = httpClient ?? http.Client(),
        _connectionTimeout = connectionTimeout,
        _streamTimeout = streamTimeout,
        _maxAttempts = maxAttempts;

  final http.Client _httpClient;
  final Duration _connectionTimeout;
  final Duration _streamTimeout;
  final int _maxAttempts;

  Stream<SseEvent> stream({
    required String url,
    required Map<String, dynamic> body,
    Map<String, String> headers = const {},
  }) async* {
    var attempt = 0;
    while (attempt < _maxAttempts) {
      attempt++;
      final request = http.Request('POST', Uri.parse(url))
        ..headers.addAll({
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...headers,
        })
        ..body = jsonEncode(body);

      try {
        final response = await _httpClient.send(request).timeout(_connectionTimeout);
        if (response.statusCode != 200) {
          // Do not surface a raw backend body to the UI: it may contain sensitive details.
          await response.stream.listen((_) {}).cancel();
          if (attempt >= _maxAttempts) {
            yield SseError('HTTP ${response.statusCode}: تعذّر إكمال طلب الدردشة.');
            return;
          }
        } else {
          final buffer = StringBuffer();
          await for (final chunk in response.stream
              .timeout(_streamTimeout)
              .transform(utf8.decoder)) {
            buffer.write(chunk);
            var data = buffer.toString();
            var index = data.indexOf('\n');
            while (index != -1) {
              final line = data.substring(0, index).trim();
              data = data.substring(index + 1);
              if (line.isNotEmpty && !line.startsWith(':')) {
                var payload = line;
                if (payload.startsWith('data:')) payload = payload.substring(5).trim();
                final event = _parsePayload(payload);
                if (event != null) {
                  yield event;
                  if (event is SseError) return;
                }
              }
              index = data.indexOf('\n');
            }
            buffer
              ..clear()
              ..write(data);
          }

          final rest = buffer.toString().trim();
          if (rest.isNotEmpty) {
            var payload = rest;
            if (payload.startsWith('data:')) payload = payload.substring(5).trim();
            final event = _parsePayload(payload);
            if (event != null) {
              yield event;
              if (event is SseError) return;
            }
          }
          return;
        }
      } on TimeoutException {
        if (attempt >= _maxAttempts) {
          yield SseError('انتهت مهلة الاتصال بخدمة الدردشة.');
          return;
        }
      } catch (error) {
        if (attempt >= _maxAttempts) {
          yield SseError('انقطع اتصال الدردشة: ${error.toString()}');
          return;
        }
      }

      if (attempt < _maxAttempts) {
        await Future<void>.delayed(const Duration(seconds: 2));
      }
    }
  }

  SseEvent? _parsePayload(String payload) {
    if (payload.isEmpty || payload.startsWith(':')) return null;
    if (payload == '[DONE]') return SseDone();
    try {
      final json = jsonDecode(payload);
      if (json is! Map<String, dynamic>) return SseError('أرسل الخادم حدثًا غير صالح.');
      if (json.containsKey('chunk')) return SseChunk(json['chunk']?.toString() ?? '');
      if (json.containsKey('tool_event')) {
        final raw = json['tool_event'];
        final event = raw is Map<String, dynamic>
            ? raw
            : <String, dynamic>{'message': raw?.toString(), 'status': 'running'};
        return SseToolEvent(
          tool: event['tool']?.toString() ?? '',
          status: event['status']?.toString() ?? 'running',
          message: event['message']?.toString(),
        );
      }
      if (json['done'] == true) {
        return SseDone(usage: json['usage'] is Map<String, dynamic> ? json['usage'] as Map<String, dynamic> : null);
      }
      if (json.containsKey('error')) return SseError(json['error']?.toString() ?? 'فشل الطلب.');
      return null;
    } catch (_) {
      return SseError('أرسل الخادم حدثًا غير صالح.');
    }
  }

  void dispose() => _httpClient.close();
}
