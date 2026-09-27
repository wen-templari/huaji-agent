const DEFAULT_ROBOT_ID = 'default';

function encodeIdentifierPart(value: string): string {
  if (value.length === 0) {
    throw new Error('Identifier components must not be empty');
  }

  return encodeURIComponent(value);
}

export function createConversationId(input: {
  bridgeInstance: string;
  robotId: string | null;
  groupId: string;
  rootMessageId: string;
}): string {
  const robotId = input.robotId ?? DEFAULT_ROBOT_ID;
  return ['huajibot', input.bridgeInstance, robotId, input.groupId, input.rootMessageId]
    .map((part, index) => (index === 0 ? part : encodeIdentifierPart(part)))
    .join(':');
}

export function createEventId(input: {
  bridgeInstance: string;
  robotId: string | null;
  groupId: string;
  messageId: string;
}): string {
  return [input.bridgeInstance, input.robotId ?? DEFAULT_ROBOT_ID, input.groupId, input.messageId]
    .map(encodeIdentifierPart)
    .join(':');
}
