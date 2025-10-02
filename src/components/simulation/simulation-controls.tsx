'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Play, Pause, Square, RotateCcw, StepForward } from 'lucide-react';
import { createMachine, createActor, type AnyStateMachine } from 'xstate';
import { SCXMLParser } from '@/lib/parsers/scxml-parser';
import { SCXMLToXStateConverter } from '@/lib/converters/scxml-to-xstate';

interface SimulationControlsProps {
  scxmlContent: string;
  onStateChange?: (currentState: string) => void;
}

type SimulationStatus = 'stopped' | 'running' | 'paused';

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  scxmlContent,
  onStateChange,
}) => {
  const [status, setStatus] = useState<SimulationStatus>('stopped');
  const [currentState, setCurrentState] = useState<string>('');
  const [actor, setActor] = useState<any>(null);
  const [machine, setMachine] = useState<AnyStateMachine | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create XState machine from SCXML
  const createMachineFromSCXML = useCallback(() => {
    if (!scxmlContent.trim()) {
      setError('No SCXML content to simulate');
      return null;
    }

    try {
      const parser = new SCXMLParser();
      const converter = new SCXMLToXStateConverter();

      const parseResult = parser.parse(scxmlContent);

      if (parseResult.success && parseResult.data) {
        const config = converter.convertToXState(parseResult.data);

        // Create a simple machine for now
        const machine = createMachine(config);

        setError(null);
        return machine;
      } else {
        setError(
          'Failed to parse SCXML: ' +
            parseResult.errors.map((e) => e.message).join(', ')
        );
        return null;
      }
    } catch (err) {
      console.error('Error creating machine:', err);
      // setError(
      //   'Error creating machine: ' +
      //     (err instanceof Error ? err.message : String(err))
      // );
      return null;
    }
  }, [scxmlContent]);

  // Initialize machine when SCXML content changes
  useEffect(() => {
    const newMachine = createMachineFromSCXML();
    setMachine(newMachine);

    if (actor) {
      actor.stop();
    }
    setActor(null);
    setStatus('stopped');
    setCurrentState('');
  }, [scxmlContent, createMachineFromSCXML]);

  // Start simulation
  const handleStart = useCallback(() => {
    if (!machine) return;

    try {
      const newActor = createActor(machine);

      newActor.subscribe((state) => {
        const stateValue =
          typeof state.value === 'string'
            ? state.value
            : typeof state.value === 'object' && state.value
            ? Object.keys(state.value)[0]
            : '';
        setCurrentState(stateValue);
        onStateChange?.(stateValue);
      });

      newActor.start();
      setActor(newActor);
      setStatus('running');
      setError(null);
    } catch (err) {
      setError(
        'Error starting simulation: ' +
          (err instanceof Error ? err.message : String(err))
      );
    }
  }, [machine, onStateChange]);

  // Pause simulation
  const handlePause = useCallback(() => {
    setStatus('paused');
  }, []);

  // Resume simulation
  const handleResume = useCallback(() => {
    setStatus('running');
  }, []);

  // Stop simulation
  const handleStop = useCallback(() => {
    if (actor) {
      actor.stop();
      setActor(null);
    }
    setStatus('stopped');
    setCurrentState('');
    onStateChange?.('');
  }, [actor, onStateChange]);

  // Reset simulation
  const handleReset = useCallback(() => {
    handleStop();
    // Immediately restart if we were running
    if (status === 'running') {
      setTimeout(handleStart, 100);
    }
  }, [handleStop, handleStart, status]);

  // Send event to machine
  const handleSendEvent = useCallback(
    (event: string) => {
      if (actor && status === 'running') {
        try {
          actor.send({ type: event });
        } catch (err) {
          setError(
            'Error sending event: ' +
              (err instanceof Error ? err.message : String(err))
          );
        }
      }
    },
    [actor, status]
  );

  // Step forward (for debugging)
  const handleStep = useCallback(() => {
    // For now, this is a placeholder
    // In a full implementation, this would step through the state machine
  }, []);

  return (
    <div className='p-4 bg-white border-b'>
      {/* <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-3'>
          <h3 className='text-sm font-medium text-gray-700'>
            Simulation Controls
          </h3>
          {currentState && (
            <div className='flex items-center space-x-2'>
              <span className='text-xs text-gray-500'>Current State:</span>
              <span className='px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium'>
                {currentState}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {status === 'stopped' && (
            <button
              onClick={handleStart}
              disabled={!machine || !!error}
              className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 text-green-800 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              <Play className="h-3 w-3" />
              <span>Start</span>
            </button>
          )}

          {status === 'running' && (
            <button
              onClick={handlePause}
              className="flex items-center space-x-1 px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 transition-colors text-sm"
            >
              <Pause className="h-3 w-3" />
              <span>Pause</span>
            </button>
          )}

          {status === 'paused' && (
            <button
              onClick={handleResume}
              className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors text-sm"
            >
              <Play className="h-3 w-3" />
              <span>Resume</span>
            </button>
          )}

          {(status === 'running' || status === 'paused') && (
            <button
              onClick={handleStop}
              className="flex items-center space-x-1 px-3 py-1.5 bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors text-sm"
            >
              <Square className="h-3 w-3" />
              <span>Stop</span>
            </button>
          )}

          <button
            onClick={handleReset}
            disabled={status === 'stopped'}
            className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>

          <button
            onClick={handleStep}
            disabled={status !== 'paused'}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <StepForward className="h-3 w-3" />
            <span>Step</span>
          </button>
        </div>
      </div> */}

      {/* Event buttons - show events that can be sent */}
      {actor && status === 'running' && (
        <div className='mt-3 pt-3 border-t'>
          <div className='flex items-center space-x-2'>
            <span className='text-xs text-gray-500'>Send Event:</span>
            <button
              onClick={() => handleSendEvent('next')}
              className='px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border hover:bg-blue-100 transition-colors'
            >
              next
            </button>
            <button
              onClick={() => handleSendEvent('start')}
              className='px-2 py-1 bg-green-50 text-green-700 text-xs rounded border hover:bg-green-100 transition-colors'
            >
              start
            </button>
            <button
              onClick={() => handleSendEvent('stop')}
              className='px-2 py-1 bg-red-50 text-red-700 text-xs rounded border hover:bg-red-100 transition-colors'
            >
              stop
            </button>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className='mt-3 p-2 bg-red-50 border border-red-200 rounded'>
          <p className='text-xs text-red-600'>{error}</p>
        </div>
      )}
    </div>
  );
};
