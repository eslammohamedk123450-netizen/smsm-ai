import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

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
  SseClient({http.Client? httpClient, Duration connectionTimeout = const Duration(seconds: 30)})
      : _httpClient = httpClient ?? http.Client(),
        _connectionTimeout = connectionTimeout;

  final http.Client _httpClient;
  final Duration _connectionTimeout;

  /// Opens a POST stream and yields parsed [SseEvent]s handling
  /// `{chunk}`, `{tool_event}`, and `{done: true}` payloads.
  Stream<SseEvent> stream({
    required String url,
    required Map<String, dynamic> body,
    Map<String, String> headers = const {},
  }) async* {
    final request = http.Request('POST', Uri.parse(url))
      ..headers.addAll({
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...headers,
      })
      ..body = jsonEncode(body);

    late http.StreamedResponse response;
    try {
      response = await _httpClient.send(request).timeout(_connectionTimeout);
    } on TimeoutException {
      yield SseError('SSE connection timed out');
      return;
    }

      if (response.statusCode != 200) {
        String body = '';
        try {
          body = await response.stream.bytesToString();
        } catch (_) {}
        yield SseError('HTTP ${response.statusCode}: $body');
        return;
      }

    final buffer = StringBuffer();
    try {
      await for (final chunk in response.stream.transform(utf8.decoder)) {
        buffer.write(chunk);
        String data = buffer.toString();
        int idx;
        while ((idx = data.indexOf('\n')) != -1) {
          final line = data.substring(0, idx).trim();
          data = data.substring(idx + 1);
          if (line.isEmpty) continue;
          String payload = line;
          if (payload.startsWith('data:')) {
            payload = payload.substring(5).trim();
          }
          if (payload == '[DONE]') {
            yield SseDone();
            continue;
          }
          try {
            final json = jsonDecode(payload) as Map<String, dynamic>;
            if (json.containsKey('chunk')) {
              yield SseChunk(json['chunk']?.toString() ?? '');
            } else if (json.containsKey('tool_event')) {
              final rawTe = json['tool_event'];
              final te = rawTe is Map<String, dynamic>
                  ? rawTe
                  : <String, dynamic>{'message': rawTe?.toString(), 'status': 'running'};
              yield SseToolEvent(
                tool: te['tool']?.toString() ?? '',
                status: te['status']?.toString() ?? 'running',
                message: te['message']?.toString(),
              );
            } else if (json['done'] == true) {
              yield SseDone(usage: json['usage'] as Map<String, dynamic>?);
            } else if (json.containsKey('error')) {
              yield SseError(json['error'].toString());
            }
          } catch (_) {
            // Ignore malformed lines.
          }
        }
        buffer
          ..clear()
          ..write(data);
      }
      final rest = buffer.toString().trim();
      if (rest.isNotEmpty) {
        try {
          final json = jsonDecode(rest) as Map<String, dynamic>;
          if (json.containsKey('chunk')) yield SseChunk(json['chunk']?.toString() ?? '');
          if (json['done'] == true) yield SseDone(usage: json['usage'] as Map<String, dynamic>?);
        } catch (_) {}
      }
    } catch (e) {
      yield SseError(e.toString());
    }
  }

  void dispose() => _httpClient.close();
}
