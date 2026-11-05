import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../errors/exceptions.dart';

class SseClient {
  final http.Client _httpClient;
  final Duration _connectionTimeout;

  SseClient({http.Client? httpClient, Duration connectionTimeout = const Duration(seconds: 30)})
      : _httpClient = httpClient ?? http.Client(),
        _connectionTimeout = connectionTimeout;

  Stream<String> connect(String url, Map<String, String> headers) async* {
    final request = http.Request('GET', Uri.parse(url))
      ..headers.addAll(headers)
      ..headers.addAll({
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

    try {
      final streamedResponse = await _httpClient.send(request).timeout(_connectionTimeout);
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode != 200) {
        throw StreamException(
          message: 'SSE connection failed with status ${response.statusCode}',
          statusCode: response.statusCode,
        );
      }

      await for (final chunk in streamedResponse.stream.transform(Utf8Decoder()).transform(const LineSplitter())) {
        if (chunk.startsWith('data: ')) {
          yield chunk.substring(6);
        }
      }
    } on TimeoutException {
      throw StreamException(message: 'SSE connection timed out');
    } on StreamException {
      rethrow;
    } catch (e) {
      throw StreamException(message: e.toString());
    }
  }

  Stream<Map<String, dynamic>> connectJson(String url, Map<String, String> headers) async* {
    await for (final data in connect(url, headers)) {
      if (data.isEmpty) continue;
      try {
        yield jsonDecode(data) as Map<String, dynamic>;
      } catch (_) {
        continue;
      }
    }
  }

  void dispose() {
    _httpClient.close();
  }
}
