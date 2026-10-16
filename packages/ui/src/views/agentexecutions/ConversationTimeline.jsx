import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { Accordion, AccordionDetails, AccordionSummary, Box, Chip, Typography } from '@mui/material'
import { IconChevronDown } from '@tabler/icons-react'
import executionsApi from '@/api/executions'

const parseJson = (value) => {
    if (!value) return undefined
    if (typeof value === 'object') return value
    try {
        return JSON.parse(value)
    } catch {
        return value
    }
}

const formatTime = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    return date.toLocaleString()
}

const fallbackTurns = (data) => {
    const protocol = data?.output?.a2a || data?.output?.cao
    if (!protocol) return []
    const turns = Array.isArray(protocol.turns) ? protocol.turns : []
    const message = turns.find((turn) => turn.role === 'user')?.text || data?.input?.message || data?.input?.task || ''
    const output = turns.find((turn) => turn.role === 'agent')?.text || data?.output?.content || ''
    const kind = data?.output?.cao ? 'cao' : 'a2a'
    return [
        {
            id: 'current',
            kind,
            status: protocol.status || 'completed',
            message,
            output,
            externalSession: protocol.contextId || protocol.sessionName,
            externalTask: protocol.taskId || protocol.terminalId,
            rawRequest: protocol.request,
            rawResponse: protocol.response,
            createdDate: undefined
        }
    ]
}

const idLabel = (kind, field) => {
    if (kind === 'cao') return field === 'session' ? 'session' : 'terminal'
    return field === 'session' ? 'contextId' : 'taskId'
}

export const ConversationTimeline = ({ data, metadata, isPublic }) => {
    const protocol = data?.output?.a2a || data?.output?.cao
    const isConversation = Boolean(protocol) || data?.name === 'a2aAgentflow' || data?.name === 'caoAgentflow'
    const [turns, setTurns] = useState([])
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        let cancelled = false
        if (!isConversation || isPublic || !metadata?.id || !data?.id) {
            setTurns(fallbackTurns(data))
            setLoaded(true)
            return undefined
        }
        executionsApi
            .getExecutionConversations(metadata.id, data.id)
            .then((response) => {
                if (cancelled) return
                const rows = Array.isArray(response.data) ? response.data : []
                setTurns(rows.length ? rows : fallbackTurns(data))
                setLoaded(true)
            })
            .catch(() => {
                if (cancelled) return
                setTurns(fallbackTurns(data))
                setLoaded(true)
            })
        return () => {
            cancelled = true
        }
    }, [data, isConversation, isPublic, metadata?.id])

    if (!isConversation || !loaded || turns.length === 0) return null

    return (
        <Box sx={{ mt: 2 }}>
            <Typography variant='h5' gutterBottom>
                Conversation / 对话
            </Typography>
            <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 1 }}>
                Turns for this node stay on the flow and are listed across runs.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {turns.map((turn, index) => (
                    <Box
                        key={turn.id || index}
                        sx={{
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1,
                            p: 1.5
                        }}
                    >
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1, alignItems: 'center' }}>
                            <Chip size='small' label={turn.kind || 'turn'} />
                            {turn.status && <Chip size='small' variant='outlined' label={turn.status} />}
                            {turn.createdDate && (
                                <Typography variant='caption' color='text.secondary'>
                                    {formatTime(turn.createdDate)}
                                </Typography>
                            )}
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                            {turn.externalSession && (
                                <Typography variant='caption'>
                                    {idLabel(turn.kind, 'session')}: {turn.externalSession}
                                </Typography>
                            )}
                            {turn.externalTask && (
                                <Typography variant='caption'>
                                    {idLabel(turn.kind, 'task')}: {turn.externalTask}
                                </Typography>
                            )}
                        </Box>
                        {turn.message && (
                            <Box
                                sx={{
                                    alignSelf: 'flex-end',
                                    ml: 'auto',
                                    maxWidth: '90%',
                                    mb: 1,
                                    p: 1,
                                    borderRadius: 1,
                                    bgcolor: 'primary.light',
                                    color: 'primary.contrastText'
                                }}
                            >
                                <Typography variant='caption' sx={{ display: 'block', opacity: 0.8 }}>
                                    user
                                </Typography>
                                <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {turn.message}
                                </Typography>
                            </Box>
                        )}
                        {turn.output && (
                            <Box
                                sx={{
                                    maxWidth: '90%',
                                    p: 1,
                                    borderRadius: 1,
                                    bgcolor: 'action.hover'
                                }}
                            >
                                <Typography variant='caption' color='text.secondary' sx={{ display: 'block' }}>
                                    agent
                                </Typography>
                                <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {turn.output}
                                </Typography>
                            </Box>
                        )}
                        <Accordion disableGutters elevation={0} sx={{ mt: 1, '&:before': { display: 'none' } }}>
                            <AccordionSummary expandIcon={<IconChevronDown size={16} />}>
                                <Typography variant='caption'>Raw JSON</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Box component='pre' sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>
                                    {JSON.stringify(
                                        { request: parseJson(turn.rawRequest), response: parseJson(turn.rawResponse) },
                                        null,
                                        2
                                    )}
                                </Box>
                            </AccordionDetails>
                        </Accordion>
                    </Box>
                ))}
            </Box>
        </Box>
    )
}

ConversationTimeline.propTypes = {
    data: PropTypes.object,
    metadata: PropTypes.object,
    isPublic: PropTypes.bool
}
