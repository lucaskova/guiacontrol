"""CommunicationCenter — central inteligente de comunicação do GuiaControl.

Arquitetura orientada a eventos + fila + workers. A APIBrasil é apenas um
CommunicationProvider (transporte), nunca regra de negócio.
"""

from communication.service import CommunicationCenter

__all__ = ["CommunicationCenter"]
